/**
 * Money helpers.
 *
 * Amounts cross the API boundary as plain decimal numbers (e.g. 10.5), but
 * every calculation is done in integer cents. Adding/subtracting raw floats
 * accumulates error (0.1 + 0.2 === 0.30000000000000004), which is not
 * acceptable for balances. Converting to cents, doing integer math, and
 * converting back keeps every stored value exact to 2 decimal places.
 */
const CENTS = 100;

/**
 * Largest amount (in cents) we accept: 10 trillion currency units. Above
 * roughly 15 significant digits a decimal with 2 fraction digits can no
 * longer be represented exactly by a double, so the cents conversion would
 * start to drift.
 */
const MAX_CENTS = 1e15;

function toCents(amount) {
  return Math.round(amount * CENTS);
}

function fromCents(cents) {
  return cents / CENTS;
}

function add(a, b) {
  return fromCents(toCents(a) + toCents(b));
}

function subtract(a, b) {
  return fromCents(toCents(a) - toCents(b));
}

/** True when `a` is strictly less than `b`, compared in cents. */
function lessThan(a, b) {
  return toCents(a) < toCents(b);
}

/** Sums an array of decimal amounts exactly. */
function sum(amounts) {
  return fromCents(amounts.reduce((acc, n) => acc + toCents(n), 0));
}

/**
 * A valid monetary amount is a finite, positive number with at most two
 * decimal places, small enough to be represented exactly in cents.
 */
function isValidAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return false;
  }
  const cents = toCents(value);
  if (cents > MAX_CENTS) return false;
  // Reject e.g. 1.005 - it has more precision than a currency can hold.
  return Math.abs(value * CENTS - cents) < 1e-6;
}

/** True when adding `amount` to `balance` would exceed the safe range. */
function wouldOverflow(balance, amount) {
  return toCents(balance) + toCents(amount) > MAX_CENTS;
}

module.exports = {
  CENTS,
  MAX_CENTS,
  toCents,
  fromCents,
  add,
  subtract,
  lessThan,
  sum,
  isValidAmount,
  wouldOverflow,
};
