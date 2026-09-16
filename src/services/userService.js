const { users, generateId } = require("../store");
const AppError = require("../errors/AppError");
const money = require("../utils/money");
const { recordTransaction, getTransactionsForUser } = require("./transactionService");

/** Throws if the user doesn't exist; otherwise returns the user record. */
function getUserOrThrow(userId) {
  const user = users.get(userId);
  if (!user) {
    throw new AppError(`User '${userId}' does not exist`, 404);
  }
  return user;
}

function createUser({ name, initialBalance = 0 }) {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new AppError("'name' is required and must be a non-empty string", 400);
  }
  if (initialBalance !== 0 && !money.isValidAmount(initialBalance)) {
    throw new AppError(
      "'initialBalance' must be a positive number with at most 2 decimal places (or omitted for 0)",
      400
    );
  }

  const user = {
    id: generateId("user"),
    name: name.trim(),
    balance: initialBalance,
  };
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
  if (!money.isValidAmount(amount)) {
    throw new AppError("'amount' must be a positive number with at most 2 decimal places", 400);
  }
  const user = getUserOrThrow(userId);

  if (money.wouldOverflow(user.balance, amount)) {
    throw new AppError("Top-up would exceed the maximum supported balance", 400);
  }

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
  getUserOrThrow(userId); // ensures 404 for unknown users
  return getTransactionsForUser(userId);
}

module.exports = { getUserOrThrow, createUser, topUp, getBalance, getTransactionHistory };
