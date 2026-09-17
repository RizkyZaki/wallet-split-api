const AppError = require("../errors/AppError");
const money = require("../utils/money");
const { assertAmount } = require("../utils/validation");
const { getUserOrThrow, assertCanDebit, assertCanCredit } = require("./userService");
const { recordTransaction } = require("./transactionService");

// All checks run before either balance changes, so a rejected transfer
// never leaves the store half-updated.
function transfer({ fromUserId, toUserId, amount }) {
  if (!fromUserId || !toUserId) throw new AppError("'fromUserId' and 'toUserId' are required");
  if (fromUserId === toUserId) throw new AppError("'fromUserId' and 'toUserId' must be different users");
  assertAmount(amount, "amount");

  const sender = getUserOrThrow(fromUserId);
  const receiver = getUserOrThrow(toUserId);
  assertCanDebit(sender, amount);
  assertCanCredit(receiver, amount);

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
