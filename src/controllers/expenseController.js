const expenseService = require("../services/expenseService");

function createExpense(req, res) {
  const expense = expenseService.createExpense(req.body || {});
  res.status(201).json(expense);
}

function getExpense(req, res) {
  const expense = expenseService.getExpense(req.params.id);
  res.status(200).json(expense);
}

module.exports = { createExpense, getExpense };
