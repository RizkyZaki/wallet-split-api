const crypto = require("crypto");

// In-memory storage, per the assignment. Only services touch these maps.
const users = new Map();
const transactions = new Map();
const expenses = new Map();

const generateId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

function reset() {
  users.clear();
  transactions.clear();
  expenses.clear();
}

module.exports = { users, transactions, expenses, generateId, reset };
