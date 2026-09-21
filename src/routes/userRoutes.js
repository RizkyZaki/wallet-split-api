const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/users", userController.createUser);
router.get("/users", userController.listUsers);
router.post("/users/:id/topup", userController.topUp);
router.get("/users/:id/balance", userController.getBalance);
router.get("/users/:id/transactions", userController.getTransactions);
router.get("/users/:id/debts", userController.getDebts);
router.post("/transfers", userController.transfer);

module.exports = router;
