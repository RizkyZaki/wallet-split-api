const AppError = require("../errors/AppError");
const { expenses, generateId } = require("../store");
const money = require("../utils/money");
const { assertAmount, assertNonEmptyString } = require("../utils/validation");
const { getUserOrThrow, assertCanDebit } = require("./userService");
const { recordTransaction } = require("./transactionService");

const SPLIT_TYPES = ["equal", "custom"];

// Leftover cents (e.g. 10 / 3) go one each to the first participants, so
// the shares always sum to the total exactly.
function splitEqually(totalAmount, participantIds) {
  const totalCents = money.toCents(totalAmount);
  const base = Math.floor(totalCents / participantIds.length);
  const remainder = totalCents % participantIds.length;

  return participantIds.map((userId, i) => ({
    userId,
    amount: money.fromCents(base + (i < remainder ? 1 : 0)),
  }));
}

function resolveCustomSplits(splits, participantIds, totalAmount) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new AppError("'splits' is required for a custom split and must be a non-empty array");
  }

  const participantSet = new Set(participantIds);
  const seen = new Set();
  for (const entry of splits) {
    if (!entry || typeof entry.userId !== "string") {
      throw new AppError("Each custom split entry needs a 'userId' and an 'amount'");
    }
    assertAmount(entry.amount, "splits[].amount");
    if (!participantSet.has(entry.userId)) {
      throw new AppError(`Split entry references '${entry.userId}', which is not in 'participantIds'`);
    }
    if (seen.has(entry.userId)) {
      throw new AppError(`Duplicate split entry for user '${entry.userId}'`);
    }
    seen.add(entry.userId);
  }
  if (seen.size !== participantSet.size) {
    throw new AppError("Every participant must have exactly one split entry");
  }

  const splitTotal = money.sum(splits.map((s) => s.amount));
  if (splitTotal !== totalAmount) {
    throw new AppError(`Split total (${splitTotal}) must match the expense total (${totalAmount})`);
  }

  return splits.map((s) => ({ userId: s.userId, amount: s.amount }));
}

function createExpense({ payerId, participantIds, totalAmount, splitType = "equal", splits }) {
  assertNonEmptyString(payerId, "payerId");
  assertAmount(totalAmount, "totalAmount");
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new AppError("'participantIds' cannot be empty");
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new AppError("'participantIds' contains duplicate users");
  }
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new AppError(`'splitType' must be one of: ${SPLIT_TYPES.join(", ")}`);
  }

  const payer = getUserOrThrow(payerId);
  participantIds.forEach(getUserOrThrow);
  assertCanDebit(payer, totalAmount);

  const resolvedSplits =
    splitType === "equal"
      ? splitEqually(totalAmount, participantIds)
      : resolveCustomSplits(splits, participantIds, totalAmount);

  // The payer fronts the whole bill. Participants' shares are recorded as
  // what they owe, not auto-debited - see README "Design decisions".
  payer.balance = money.subtract(payer.balance, totalAmount);
  recordTransaction({
    type: "EXPENSE_PAID",
    userId: payer.id,
    amount: totalAmount,
    balanceAfter: payer.balance,
    description: `Paid group expense (${participantIds.length} participants)`,
  });
  for (const share of resolvedSplits) {
    const isPayer = share.userId === payer.id;
    recordTransaction({
      type: "EXPENSE_SHARE",
      userId: share.userId,
      amount: share.amount,
      relatedUserId: isPayer ? null : payer.id,
      description: isPayer ? "Own share of group expense" : `Owes ${payer.name} for shared expense`,
    });
  }

  const expense = {
    id: generateId("exp"),
    payerId: payer.id,
    participantIds,
    totalAmount,
    splitType,
    splits: resolvedSplits,
    createdAt: new Date().toISOString(),
  };
  expenses.set(expense.id, expense);
  return expense;
}

function getExpense(expenseId) {
  const expense = expenses.get(expenseId);
  if (!expense) throw new AppError(`Expense '${expenseId}' does not exist`, 404);
  return expense;
}

module.exports = { createExpense, getExpense, splitEqually };
