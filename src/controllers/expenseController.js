const expenseService = require("../services/expenseService");
const { ok } = require("../utils/response");

function createExpense(req, res) {
  ok(res, expenseService.createExpense(req.body || {}), 201);
}

function getExpense(req, res) {
  ok(res, expenseService.getExpense(req.params.id));
}

module.exports = { createExpense, getExpense };
