const crypto = require("crypto");

/**
 * Single in-memory store, intentionally kept as plain Maps.
 *
 * This is NOT persisted anywhere on purpose (per the assignment's
 * "Database: in-memory" constraint) - restarting the process wipes
 * all data. Services are the only code allowed to touch these maps
 * directly, so the storage layer could later be swapped for a real
 * database without touching route/controller code.
 */
const users = new Map(); // id -> { id, name, balance }
const transactions = new Map(); // id -> { id, type, userId, amount, relatedUserId, balanceAfter, description, createdAt }
const expenses = new Map(); // id -> { id, payerId, participantIds, totalAmount, splitType, splits, createdAt }

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

/** Wipes all data. Used between test cases so tests don't leak state. */
function reset() {
  users.clear();
  transactions.clear();
  expenses.clear();
}

module.exports = { users, transactions, expenses, generateId, reset };
