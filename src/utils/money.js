// All arithmetic is done in integer cents so balances never accumulate
// floating-point error (0.1 + 0.2 !== 0.3 in plain JS numbers).
const CENTS = 100;

// Beyond ~15 significant digits a 2-decimal number is no longer exact in a double.
const MAX_CENTS = 1e15;

const toCents = (amount) => Math.round(amount * CENTS);
const fromCents = (cents) => cents / CENTS;

const add = (a, b) => fromCents(toCents(a) + toCents(b));
const subtract = (a, b) => fromCents(toCents(a) - toCents(b));
const lessThan = (a, b) => toCents(a) < toCents(b);
const sum = (amounts) => fromCents(amounts.reduce((acc, n) => acc + toCents(n), 0));

function isValidAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return false;
  const cents = toCents(value);
  return cents <= MAX_CENTS && Math.abs(value * CENTS - cents) < 1e-6;
}

const wouldOverflow = (balance, amount) => toCents(balance) + toCents(amount) > MAX_CENTS;

module.exports = { CENTS, MAX_CENTS, toCents, fromCents, add, subtract, lessThan, sum, isValidAmount, wouldOverflow };
