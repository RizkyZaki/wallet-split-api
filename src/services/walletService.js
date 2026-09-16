const AppError = require("../errors/AppError");
const money = require("../utils/money");
const { getUserOrThrow } = require("./userService");
const { recordTransaction } = require("./transactionService");

/**
 * Transfers `amount` from one user's wallet to another.
 * Both legs are recorded as separate transaction-history entries so each
 * user's history reads naturally ("sent to X" / "received from Y").
 *
 * All validation happens before either balance is touched, so a rejected
 * transfer never leaves the store half-updated.
 */
function transfer({ fromUserId, toUserId, amount }) {
  if (!fromUserId || !toUserId) {
    throw new AppError("'fromUserId' and 'toUserId' are required", 400);
  }
  if (fromUserId === toUserId) {
    throw new AppError("'fromUserId' and 'toUserId' must be different users", 400);
  }
  if (!money.isValidAmount(amount)) {
    throw new AppError("'amount' must be a positive number with at most 2 decimal places", 400);
  }

  const sender = getUserOrThrow(fromUserId);
  const receiver = getUserOrThrow(toUserId);

  if (money.lessThan(sender.balance, amount)) {
    throw new AppError(
      `Insufficient balance: user '${fromUserId}' has ${sender.balance}, needs ${amount}`,
      400
    );
  }
  if (money.wouldOverflow(receiver.balance, amount)) {
    throw new AppError("Transfer would exceed the receiver's maximum supported balance", 400);
  }

  sender.balance = money.subtract(sender.balance, amount);
  receiver.balance = money.add(receiver.balance, amount);

  const senderTx = recordTransaction({
    type: "TRANSFER_OUT",
    userId: sender.id,
    amount,
    relatedUserId: receiver.id,
    balanceAfter: sender.balance,
    description: `Transfer to ${receiver.name}`,
  });

  recordTransaction({
    type: "TRANSFER_IN",
    userId: receiver.id,
    amount,
    relatedUserId: sender.id,
    balanceAfter: receiver.balance,
    description: `Transfer from ${sender.name}`,
  });

  return {
    fromUserId: sender.id,
    toUserId: receiver.id,
    amount,
    senderBalance: sender.balance,
    receiverBalance: receiver.balance,
    transactionId: senderTx.id,
  };
}

module.exports = { transfer };
