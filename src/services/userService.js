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

function getBalance(userId) {
  const user = getUserOrThrow(userId);
  return { userId: user.id, name: user.name, balance: user.balance };
}

function getTransactionHistory(userId) {
  getUserOrThrow(userId);
  return getTransactionsForUser(userId);
}

module.exports = {
  getUserOrThrow,
  assertCanDebit,
  assertCanCredit,
  createUser,
  topUp,
  getBalance,
  getTransactionHistory,
};
