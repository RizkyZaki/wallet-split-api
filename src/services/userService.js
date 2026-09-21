const { users, generateId } = require("../store");
const AppError = require("../errors/AppError");
const money = require("../utils/money");
const { assertAmount, assertNonEmptyString } = require("../utils/validation");
const { recordTransaction, getTransactionsForUser } = require("./transactionService");

function getUserOrThrow(userId) {
  const user = users.get(userId);
  if (!user) throw new AppError(`User '${userId}' does not exist`, 404);
  return user;
}

function assertCanDebit(user, amount) {
  if (money.lessThan(user.balance, amount)) {
    throw new AppError(`Insufficient balance: user '${user.id}' has ${user.balance}, needs ${amount}`);
  }
}

function assertCanCredit(user, amount) {
  if (money.wouldOverflow(user.balance, amount)) {
    throw new AppError(`Balance of user '${user.id}' would exceed the maximum supported amount`);
  }
}

function createUser({ name, initialBalance = 0 }) {
  assertNonEmptyString(name, "name");
  if (initialBalance !== 0) assertAmount(initialBalance, "initialBalance");

  const user = { id: generateId("user"), name: name.trim(), balance: initialBalance };
  users.set(user.id, user);

  if (initialBalance > 0) {
    recordTransaction({
      type: "INITIAL_BALANCE",
      userId: user.id,
      amount: initialBalance,
      balanceAfter: user.balance,
      description: "Initial wallet balance",
    });
  }
  return user;
}

function topUp(userId, amount) {
  assertAmount(amount, "amount");
  const user = getUserOrThrow(userId);
  assertCanCredit(user, amount);

  user.balance = money.add(user.balance, amount);
  return recordTransaction({
    type: "TOP_UP",
    userId: user.id,
    amount,
    balanceAfter: user.balance,
    description: "Top-up",
  });
}

function listUsers() {
  return Array.from(users.values());
}

function getBalance(userId) {
  const user = getUserOrThrow(userId);
  return { userId: user.id, name: user.name, balance: user.balance };
}

function getTransactionHistory(userId) {
  getUserOrThrow(userId);
  return getTransactionsForUser(userId);
}

// Debts are EXPENSE_SHARE entries grouped by payer (the user's own share as
// payer has no relatedUserId and is skipped), netted against settlement
// transfers - TRANSFER_OUT entries that carry an expenseId. Plain transfers
// are not counted.
function getDebts(userId) {
  getUserOrThrow(userId);
  const byPayer = new Map();

  for (const tx of getTransactionsForUser(userId)) {
    const payerId = tx.relatedUserId;
    if (!payerId) continue;

    const isShare = tx.type === "EXPENSE_SHARE";
    const isSettlement = tx.type === "TRANSFER_OUT" && tx.expenseId !== null;
    if (!isShare && !isSettlement) continue;

    const entry = byPayer.get(payerId) || { owed: [], settled: [] };
    (isShare ? entry.owed : entry.settled).push(tx.amount);
    byPayer.set(payerId, entry);
  }

  const debts = [];
  for (const [toUserId, entry] of byPayer) {
    if (entry.owed.length === 0) continue;
    const owed = money.sum(entry.owed);
    const settled = money.sum(entry.settled);
    debts.push({
      toUserId,
      toUserName: users.get(toUserId).name,
      owed,
      settled,
      outstanding: money.subtract(owed, settled),
    });
  }

  return { userId, debts };
}

module.exports = {
  getUserOrThrow,
  assertCanDebit,
  assertCanCredit,
  createUser,
  listUsers,
  topUp,
  getBalance,
  getTransactionHistory,
  getDebts,
};
