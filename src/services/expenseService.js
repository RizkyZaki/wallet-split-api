const AppError = require("../errors/AppError");
const { expenses, generateId } = require("../store");
const money = require("../utils/money");
const { getUserOrThrow } = require("./userService");
const { recordTransaction } = require("./transactionService");

/**
 * Splits `totalAmount` equally across `participantIds`, in integer cents.
 * Straight division can produce a remainder (e.g. 10 / 3 = 3.33 * 3 = 9.99),
 * so any leftover cent(s) are handed one each to the first participants in
 * the list. This guarantees sum(shares) === totalAmount exactly, every time.
 */
function splitEqually(totalAmount, participantIds) {
  const totalCents = money.toCents(totalAmount);
  const baseCents = Math.floor(totalCents / participantIds.length);
  let remainderCents = totalCents - baseCents * participantIds.length;

  return participantIds.map((userId) => {
    const cents = baseCents + (remainderCents > 0 ? 1 : 0);
    if (remainderCents > 0) remainderCents -= 1;
    return { userId, amount: money.fromCents(cents) };
  });
}

/**
 * Validates a custom split: every entry must be a positive amount for a
 * participant, every participant must appear exactly once, and the amounts
 * must add up to the expense total. Returns the normalised split list.
 */
function resolveCustomSplits(splits, participantIds, totalAmount) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new AppError("'splits' is required for a custom split and must be a non-empty array", 400);
  }

  const participantSet = new Set(participantIds);
  const seen = new Set();

  for (const entry of splits) {
    if (!entry || typeof entry.userId !== "string" || !money.isValidAmount(entry.amount)) {
      throw new AppError(
        "Each custom split entry needs a 'userId' and a positive 'amount' with at most 2 decimal places",
        400
      );
    }
    if (!participantSet.has(entry.userId)) {
      throw new AppError(`Split entry references '${entry.userId}', which is not in 'participantIds'`, 400);
    }
    if (seen.has(entry.userId)) {
      throw new AppError(`Duplicate split entry for user '${entry.userId}'`, 400);
    }
    seen.add(entry.userId);
  }

  if (seen.size !== participantSet.size) {
    throw new AppError("Every participant must have exactly one split entry", 400);
  }

  const splitTotal = money.sum(splits.map((s) => s.amount));
  if (splitTotal !== totalAmount) {
    throw new AppError(`Split total (${splitTotal}) must match the expense total (${totalAmount})`, 400);
  }

  return splits.map((s) => ({ userId: s.userId, amount: s.amount }));
}

function createExpense({ payerId, participantIds, totalAmount, splitType = "equal", splits }) {
  if (typeof payerId !== "string" || payerId.trim().length === 0) {
    throw new AppError("'payerId' is required", 400);
  }
  if (!money.isValidAmount(totalAmount)) {
    throw new AppError("'totalAmount' must be a positive number with at most 2 decimal places", 400);
  }
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new AppError("'participantIds' cannot be empty", 400);
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new AppError("'participantIds' contains duplicate users", 400);
  }
  if (!["equal", "custom"].includes(splitType)) {
    throw new AppError("'splitType' must be 'equal' or 'custom'", 400);
  }

  const payer = getUserOrThrow(payerId);
  participantIds.forEach(getUserOrThrow); // 404s early if any participant doesn't exist

  if (money.lessThan(payer.balance, totalAmount)) {
    throw new AppError(
      `Insufficient balance: payer '${payerId}' has ${payer.balance}, needs ${totalAmount}`,
      400
    );
  }

  // Resolve the split *before* touching any balance so a bad custom split
  // rejects the whole request without side effects.
  const resolvedSplits =
    splitType === "equal"
      ? splitEqually(totalAmount, participantIds)
      : resolveCustomSplits(splits, participantIds, totalAmount);

  // The payer fronts the full amount now (e.g. paid the restaurant bill).
  // This only moves money out of the payer's wallet; participants' shares
  // are recorded as informational history entries (what they owe the payer)
  // rather than auto-debited - see README "Design decisions" for why.
  payer.balance = money.subtract(payer.balance, totalAmount);
  recordTransaction({
    type: "EXPENSE_PAID",
    userId: payer.id,
    amount: totalAmount,
    balanceAfter: payer.balance,
    description: `Paid group expense (${participantIds.length} participants)`,
  });

  for (const share of resolvedSplits) {
    recordTransaction({
      type: "EXPENSE_SHARE",
      userId: share.userId,
      amount: share.amount,
      relatedUserId: payer.id,
      balanceAfter: null, // informational only; doesn't move this user's balance
      description: `Owes ${payer.name} for shared expense`,
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
  if (!expense) {
    throw new AppError(`Expense '${expenseId}' does not exist`, 404);
  }
  return expense;
}

module.exports = { createExpense, getExpense, splitEqually };
