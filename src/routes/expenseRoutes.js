const express = require("express");
const expenseController = require("../controllers/expenseController");

const router = express.Router();

router.post("/expenses", expenseController.createExpense);
router.get("/expenses/:id", expenseController.getExpense);

module.exports = router;
