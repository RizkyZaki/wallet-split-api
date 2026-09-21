const userService = require("../services/userService");
const walletService = require("../services/walletService");

function createUser(req, res) {
  const user = userService.createUser(req.body || {});
  res.status(201).json(user);
}

function listUsers(req, res) {
  res.status(200).json(userService.listUsers());
}

function topUp(req, res) {
  const { id } = req.params;
  const { amount } = req.body || {};
  const tx = userService.topUp(id, amount);
  res.status(200).json(tx);
}

function getBalance(req, res) {
  const balance = userService.getBalance(req.params.id);
  res.status(200).json(balance);
}

function getTransactions(req, res) {
  const history = userService.getTransactionHistory(req.params.id);
  res.status(200).json(history);
}

function getDebts(req, res) {
  res.status(200).json(userService.getDebts(req.params.id));
}

function transfer(req, res) {
  const result = walletService.transfer(req.body || {});
  res.status(200).json(result);
}

module.exports = { createUser, listUsers, topUp, getBalance, getTransactions, getDebts, transfer };
