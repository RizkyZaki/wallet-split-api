const AppError = require("../errors/AppError");
const money = require("../utils/money");
const { assertAmount, assertNonEmptyString } = require("../utils/validation");
const { getUserOrThrow, assertCanDebit, assertCanCredit } = require("./userService");
const { recordTransaction, getTransactionsForUser } = require("./transactionService");
const { getExpense } = require("./expenseService");

// How much of `userId`'s share of `expense` is still unpaid.
function getOutstandingShare(expense, userId) {
  const share = expense.splits.find((s) => s.userId === userId);
  if (!share) return null;

  const settled = getTransactionsForUser(userId)
    .filter((tx) => tx.type === "TRANSFER_OUT" && tx.expenseId === expense.id)
    .map((tx) => tx.amount);

  return money.subtract(share.amount, money.sum(settled));
}

// A transfer that carries an expenseId is a settlement: it must go to the
// payer, come from a participant, and not exceed what that participant
// still owes for this expense.
function assertValidSettlement(expenseId, sender, receiver, amount) {
  assertNonEmptyString(expenseId, "expenseId");
  const expense = getExpense(expenseId);

  if (expense.payerId !== receiver.id) {
    throw new AppError(`'toUserId' must be the payer of expense '${expenseId}'`);
  }
  const outstanding = getOutstandingShare(expense, sender.id);
  if (outstanding === null) {
    throw new AppError(`'fromUserId' is not a participant of expense '${expenseId}'`);
  }
  if (outstanding === 0) {
    throw new AppError(`Share for expense '${expenseId}' is already fully settled`);
  }
  if (money.lessThan(outstanding, amount)) {
    throw new AppError(`Amount ${amount} exceeds the outstanding share of ${outstanding} for expense '${expenseId}'`);
  }
}

// All checks run before either balance changes, so a rejected transfer
// never leaves the store half-updated.
function transfer({ fromUserId, toUserId, amount, expenseId }) {
  if (!fromUserId || !toUserId) throw new AppError("'fromUserId' and 'toUserId' are required");
  if (fromUserId === toUserId) throw new AppError("'fromUserId' and 'toUserId' must be different users");
  assertAmount(amount, "amount");

  const sender = getUserOrThrow(fromUserId);
  const receiver = getUserOrThrow(toUserId);
  assertCanDebit(sender, amount);
  assertCanCredit(receiver, amount);

  const isSettlement = expenseId !== undefined && expenseId !== null;
  if (isSettlement) assertValidSettlement(expenseId, sender, receiver, amount);

  sender.balance = money.subtract(sender.balance, amount);
  receiver.balance = money.add(receiver.balance, amount);

  const purpose = isSettlement ? " (expense settlement)" : "";
  const senderTx = recordTransaction({
    type: "TRANSFER_OUT",
    userId: sender.id,
    amount,
    relatedUserId: receiver.id,
    balanceAfter: sender.balance,
    expenseId: isSettlement ? expenseId : null,
    description: `Transfer to ${receiver.name}${purpose}`,
  });
  recordTransaction({
    type: "TRANSFER_IN",
    userId: receiver.id,
    amount,
    relatedUserId: sender.id,
    balanceAfter: receiver.balance,
    expenseId: isSettlement ? expenseId : null,
    description: `Transfer from ${sender.name}${purpose}`,
  });

  return {
    fromUserId: sender.id,
    toUserId: receiver.id,
    amount,
    expenseId: isSettlement ? expenseId : null,
    senderBalance: sender.balance,
    receiverBalance: receiver.balance,
    transactionId: senderTx.id,
  };
}

module.exports = { transfer };
