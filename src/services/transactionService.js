const { transactions, generateId } = require("../store");

// Append-only log. `balanceAfter` is null for entries that do not move money;
// `expenseId` is set on transfers that settle a group expense share.
function recordTransaction({
  type,
  userId,
  amount,
  relatedUserId = null,
  balanceAfter = null,
  expenseId = null,
  description,
}) {
  const tx = {
    id: generateId("tx"),
    type,
    userId,
    amount,
    relatedUserId,
    balanceAfter,
    expenseId,
    description,
    createdAt: new Date().toISOString(),
  };
  transactions.set(tx.id, tx);
  return tx;
}

// Map preserves insertion order, so this is already chronological.
function getTransactionsForUser(userId) {
  return Array.from(transactions.values()).filter((tx) => tx.userId === userId);
}

module.exports = { recordTransaction, getTransactionsForUser };
