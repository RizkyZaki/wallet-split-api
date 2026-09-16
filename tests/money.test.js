const money = require("../src/utils/money");

describe("money helpers", () => {
  test("adds and subtracts without floating-point drift", () => {
    expect(money.add(0.1, 0.2)).toBe(0.3);
    expect(money.subtract(1, 0.9)).toBe(0.1);
    expect(money.add(0.07, 0.01)).toBe(0.08);
  });

  test("sums a list of amounts exactly", () => {
    expect(money.sum([0.1, 0.2, 0.3])).toBe(0.6);
    expect(money.sum([3.33, 3.33, 3.34])).toBe(10);
  });

  test("compares amounts in cents", () => {
    expect(money.lessThan(0.3, 0.1 + 0.2)).toBe(false);
    expect(money.lessThan(9.99, 10)).toBe(true);
  });

  test("accepts positive amounts with up to two decimal places", () => {
    expect(money.isValidAmount(1)).toBe(true);
    expect(money.isValidAmount(0.01)).toBe(true);
    expect(money.isValidAmount(10.5)).toBe(true);
    expect(money.isValidAmount(1234567.89)).toBe(true);
  });

  test("rejects zero, negatives, non-numbers, non-finite and >2 decimals", () => {
    expect(money.isValidAmount(0)).toBe(false);
    expect(money.isValidAmount(-5)).toBe(false);
    expect(money.isValidAmount("50")).toBe(false);
    expect(money.isValidAmount(NaN)).toBe(false);
    expect(money.isValidAmount(Infinity)).toBe(false);
    expect(money.isValidAmount(1.005)).toBe(false);
    expect(money.isValidAmount(1e308)).toBe(false);
  });

  test("detects balance overflow", () => {
    const nearMax = money.fromCents(money.MAX_CENTS - 1);
    expect(money.isValidAmount(nearMax)).toBe(true);
    expect(money.wouldOverflow(nearMax, 0.01)).toBe(false);
    expect(money.wouldOverflow(nearMax, 0.02)).toBe(true);
  });
});
