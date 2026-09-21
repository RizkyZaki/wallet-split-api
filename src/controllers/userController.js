const userService = require("../services/userService");
const walletService = require("../services/walletService");
const { ok } = require("../utils/response");

function createUser(req, res) {
  ok(res, userService.createUser(req.body || {}), 201);
}

function listUsers(req, res) {
  ok(res, userService.listUsers());
}

function topUp(req, res) {
  const { amount } = req.body || {};
  ok(res, userService.topUp(req.params.id, amount));
}

function getBalance(req, res) {
  ok(res, userService.getBalance(req.params.id));
}

function getTransactions(req, res) {
  ok(res, userService.getTransactionHistory(req.params.id));
}

function getDebts(req, res) {
  ok(res, userService.getDebts(req.params.id));
}

function transfer(req, res) {
  ok(res, walletService.transfer(req.body || {}));
}

module.exports = { createUser, listUsers, topUp, getBalance, getTransactions, getDebts, transfer };
