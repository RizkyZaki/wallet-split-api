const { splitEqually } = require("../src/services/expenseService");

const amounts = (splits) => splits.map((s) => s.amount);

describe("splitEqually", () => {
  test("splits evenly when the amount divides cleanly", () => {
    expect(amounts(splitEqually(90, ["a", "b", "c"]))).toEqual([30, 30, 30]);
  });

  test("hands leftover cents to the first participants", () => {
    expect(amounts(splitEqually(10, ["a", "b", "c"]))).toEqual([3.34, 3.33, 3.33]);
    expect(amounts(splitEqually(100, ["a", "b", "c", "d", "e", "f"]))).toEqual([
      16.67, 16.67, 16.67, 16.67, 16.66, 16.66,
    ]);
  });

  test("always sums back to the original total", () => {
    const cases = [
      [10, 3],
      [0.01, 3],
      [99.99, 7],
      [1, 100],
      [123.45, 11],
    ];
    for (const [total, n] of cases) {
      const ids = Array.from({ length: n }, (_, i) => `u${i}`);
      const sum = amounts(splitEqually(total, ids)).reduce((acc, a) => acc + Math.round(a * 100), 0);
      expect(sum).toBe(Math.round(total * 100));
    }
  });

  test("keeps participant order and ids", () => {
    const result = splitEqually(5, ["x", "y"]);
    expect(result).toEqual([
      { userId: "x", amount: 2.5 },
      { userId: "y", amount: 2.5 },
    ]);
  });
});
