const { transactions, generateId } = require("../store");

/**
 * Appends an immutable entry to the transaction log. Every operation that
 * changes (or, for EXPENSE_SHARE, merely concerns) a user's balance goes
 * through here so that transaction history has a single source of truth.
 *
 * `balanceAfter` is the user's balance right after this entry was applied,
 * or null for informational entries that don't move money.
 */
function recordTransaction({ type, userId, amount, relatedUserId = null, balanceAfter = null, description }) {
  const tx = {
    id: generateId("tx"),
    type,
    userId,
    amount,
    relatedUserId,
    balanceAfter,
    description,
    createdAt: new Date().toISOString(),
  };
  transactions.set(tx.id, tx);
  return tx;
}

/**
 * Returns all entries for one user in chronological order. The store is a
 * Map, which preserves insertion order, and entries are only ever appended,
 * so insertion order *is* chronological order.
 */
function getTransactionsForUser(userId) {
  return Array.from(transactions.values()).filter((tx) => tx.userId === userId);
}

module.exports = { recordTransaction, getTransactionsForUser };
