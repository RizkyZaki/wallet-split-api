const request = require("supertest");
const createApp = require("../src/app");
const store = require("../src/store");

const app = createApp();

beforeEach(() => {
  store.reset();
});

async function createUser(name, initialBalance = 0) {
  const res = await request(app).post("/api/users").send({ name, initialBalance });
  return res.body;
}

describe("Wallet creation & top-up", () => {
  test("creates a user with an initial balance", async () => {
    const res = await request(app).post("/api/users").send({ name: "Alice", initialBalance: 100 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Alice", balance: 100 });
  });

  test("lists all users in creation order", async () => {
    const empty = await request(app).get("/api/users");
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const alice = await createUser("Alice", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app).get("/api/users");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: alice.id, name: "Alice", balance: 100 },
      { id: bob.id, name: "Bob", balance: 0 },
    ]);
  });

  test("rejects a missing name", async () => {
    const res = await request(app).post("/api/users").send({ initialBalance: 50 });
    expect(res.status).toBe(400);
  });

  test("tops up an existing user's balance", async () => {
    const alice = await createUser("Alice", 100);
    const res = await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: 50 });
    expect(res.status).toBe(200);
    expect(res.body.balanceAfter).toBe(150);
  });

  test("rejects a non-positive top-up amount", async () => {
    const alice = await createUser("Alice", 100);
    const res = await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: -5 });
    expect(res.status).toBe(400);
  });

  test("404s when topping up an unknown user", async () => {
    const res = await request(app).post("/api/users/does-not-exist/topup").send({ amount: 10 });
    expect(res.status).toBe(404);
  });

  test("rejects amounts with more than two decimal places", async () => {
    const alice = await createUser("Alice", 100);
    const res = await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: 1.005 });
    expect(res.status).toBe(400);
  });

  test("keeps balances exact across many small top-ups", async () => {
    const alice = await createUser("Alice", 0);
    await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: 0.1 });
    await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: 0.2 });
    const res = await request(app).get(`/api/users/${alice.id}/balance`);
    expect(res.body.balance).toBe(0.3);
  });

  test("returns 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Content-Type", "application/json")
      .send("{not valid json");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid JSON/i);
  });
});

describe("Transaction history", () => {
  test("returns entries in chronological order with running balances", async () => {
    const alice = await createUser("Alice", 100);
    const bob = await createUser("Bob", 0);
    await request(app).post(`/api/users/${alice.id}/topup`).send({ amount: 50 });
    await request(app).post("/api/transfers").send({ fromUserId: alice.id, toUserId: bob.id, amount: 30 });

    const res = await request(app).get(`/api/users/${alice.id}/transactions`);
    expect(res.status).toBe(200);
    expect(res.body.map((t) => t.type)).toEqual(["INITIAL_BALANCE", "TOP_UP", "TRANSFER_OUT"]);
    expect(res.body.map((t) => t.balanceAfter)).toEqual([100, 150, 120]);
  });

  test("404s for an unknown user", async () => {
    const res = await request(app).get("/api/users/ghost/transactions");
    expect(res.status).toBe(404);
  });
});

describe("Transfers", () => {
  test("moves balance between two users and records both legs", async () => {
    const alice = await createUser("Alice", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: alice.id, toUserId: bob.id, amount: 40 });

    expect(res.status).toBe(200);
    expect(res.body.senderBalance).toBe(60);
    expect(res.body.receiverBalance).toBe(40);

    const aliceHistory = await request(app).get(`/api/users/${alice.id}/transactions`);
    const bobHistory = await request(app).get(`/api/users/${bob.id}/transactions`);
    expect(aliceHistory.body.some((t) => t.type === "TRANSFER_OUT")).toBe(true);
    expect(bobHistory.body.some((t) => t.type === "TRANSFER_IN")).toBe(true);
  });

  test("rejects a transfer with insufficient balance", async () => {
    const alice = await createUser("Alice", 10);
    const bob = await createUser("Bob", 0);

    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: alice.id, toUserId: bob.id, amount: 999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/i);
  });

  test("rejects a transfer to a non-existent user", async () => {
    const alice = await createUser("Alice", 100);
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: alice.id, toUserId: "ghost", amount: 10 });
    expect(res.status).toBe(404);
  });

  test("rejects a transfer to oneself", async () => {
    const alice = await createUser("Alice", 100);
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: alice.id, toUserId: alice.id, amount: 10 });
    expect(res.status).toBe(400);
  });

  test("leaves both balances untouched when the transfer is rejected", async () => {
    const alice = await createUser("Alice", 10);
    const bob = await createUser("Bob", 5);
    await request(app).post("/api/transfers").send({ fromUserId: alice.id, toUserId: bob.id, amount: 999 });

    const a = await request(app).get(`/api/users/${alice.id}/balance`);
    const b = await request(app).get(`/api/users/${bob.id}/balance`);
    expect(a.body.balance).toBe(10);
    expect(b.body.balance).toBe(5);
  });
});

describe("Group expenses - equal split", () => {
  test("splits an amount evenly, including remainder cents", async () => {
    const payer = await createUser("Payer", 100);
    const b = await createUser("Bob", 0);
    const c = await createUser("Carol", 0);

    // 10 / 3 participants = 3.33 recurring; totals must still add up exactly.
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, b.id, c.id],
      totalAmount: 10,
      splitType: "equal",
    });

    expect(res.status).toBe(201);
    expect(res.body.splits.map((s) => s.amount)).toEqual([3.34, 3.33, 3.33]);
  });

  test("debits the payer and records shares for every participant", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 40,
    });
    expect(res.status).toBe(201);

    const payerBalance = await request(app).get(`/api/users/${payer.id}/balance`);
    const bobBalance = await request(app).get(`/api/users/${bob.id}/balance`);
    expect(payerBalance.body.balance).toBe(60);
    expect(bobBalance.body.balance).toBe(0); // shares are informational, not auto-debited

    const bobHistory = await request(app).get(`/api/users/${bob.id}/transactions`);
    expect(bobHistory.body).toHaveLength(1);
    expect(bobHistory.body[0]).toMatchObject({
      type: "EXPENSE_SHARE",
      amount: 20,
      relatedUserId: payer.id,
      balanceAfter: null,
      description: "Owes Payer for shared expense",
    });

    // The payer's own share is not a debt to anyone
    const payerHistory = await request(app).get(`/api/users/${payer.id}/transactions`);
    const ownShare = payerHistory.body.find((t) => t.type === "EXPENSE_SHARE");
    expect(ownShare).toMatchObject({
      amount: 20,
      relatedUserId: null,
      description: "Own share of group expense",
    });
  });

  test("can be fetched back by id", async () => {
    const payer = await createUser("Payer", 100);
    const created = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id],
      totalAmount: 10,
    });

    const res = await request(app).get(`/api/expenses/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);

    const missing = await request(app).get("/api/expenses/nope");
    expect(missing.status).toBe(404);
  });

  test("rejects an empty participants list", async () => {
    const payer = await createUser("Payer", 100);
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [],
      totalAmount: 10,
    });
    expect(res.status).toBe(400);
  });

  test("rejects when the payer has insufficient balance", async () => {
    const payer = await createUser("Payer", 5);
    const bob = await createUser("Bob", 0);
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Insufficient balance/i);
  });

  test("rejects duplicate participants", async () => {
    const payer = await createUser("Payer", 100);
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, payer.id],
      totalAmount: 10,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duplicate/i);
  });

  test("404s when a participant does not exist", async () => {
    const payer = await createUser("Payer", 100);
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, "ghost"],
      totalAmount: 10,
    });
    expect(res.status).toBe(404);
  });

  test("rejects an unknown splitType", async () => {
    const payer = await createUser("Payer", 100);
    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id],
      totalAmount: 10,
      splitType: "random",
    });
    expect(res.status).toBe(400);
  });
});

describe("Expense settlement (transfer with expenseId)", () => {
  async function setupExpense() {
    const alice = await createUser("Alice", 100);
    const bob = await createUser("Bob", 50);
    const carol = await createUser("Carol", 100);
    // Alice pays 30 split three ways -> Bob and Carol each owe Alice 10
    const expense = await request(app).post("/api/expenses").send({
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      totalAmount: 30,
    });
    return { alice, bob, carol, expenseId: expense.body.id };
  }

  test("accepts partial payments up to the outstanding share, then rejects more", async () => {
    const { alice, bob, expenseId } = await setupExpense();

    const first = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 4, expenseId });
    expect(first.status).toBe(200);
    expect(first.body.expenseId).toBe(expenseId);

    const second = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 6, expenseId });
    expect(second.status).toBe(200);

    const third = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 1, expenseId });
    expect(third.status).toBe(400);
    expect(third.body.error).toMatch(/already fully settled/i);
  });

  test("rejects a payment that exceeds the outstanding share", async () => {
    const { alice, bob, expenseId } = await setupExpense();
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 10.01, expenseId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exceeds the outstanding share/i);
  });

  test("rejects settlement to someone other than the payer", async () => {
    const { bob, carol, expenseId } = await setupExpense();
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: carol.id, amount: 5, expenseId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be the payer/i);
  });

  test("rejects settlement from a non-participant", async () => {
    const { alice, expenseId } = await setupExpense();
    const dave = await createUser("Dave", 50);
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: dave.id, toUserId: alice.id, amount: 5, expenseId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a participant/i);
  });

  test("404s for an unknown expense and leaves balances untouched", async () => {
    const { alice, bob } = await setupExpense();
    const res = await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 5, expenseId: "exp_nope" });
    expect(res.status).toBe(404);

    const bobBalance = await request(app).get(`/api/users/${bob.id}/balance`);
    expect(bobBalance.body.balance).toBe(50);
  });
});

describe("Debts", () => {
  test("lists one debt per expense, netted against settlements for that expense only", async () => {
    const alice = await createUser("Alice", 200);
    const bob = await createUser("Bob", 50);
    const carol = await createUser("Carol", 100);

    // Alice pays 30 split three ways -> Bob owes Alice 10 (exp1)
    const exp1 = await request(app).post("/api/expenses").send({
      payerId: alice.id,
      participantIds: [alice.id, bob.id, carol.id],
      totalAmount: 30,
    });
    // Alice pays another 40 split with Bob -> Bob owes Alice 20 (exp2)
    const exp2 = await request(app).post("/api/expenses").send({
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      totalAmount: 40,
    });
    // Carol pays 20 split with Bob -> Bob owes Carol 10 (exp3)
    const exp3 = await request(app).post("/api/expenses").send({
      payerId: carol.id,
      participantIds: [carol.id, bob.id],
      totalAmount: 20,
    });
    // Bob settles 4 of exp1 only
    await request(app)
      .post("/api/transfers")
      .send({ fromUserId: bob.id, toUserId: alice.id, amount: 4, expenseId: exp1.body.id });
    // A plain transfer to Carol is not a settlement
    await request(app).post("/api/transfers").send({ fromUserId: bob.id, toUserId: carol.id, amount: 3 });

    const res = await request(app).get(`/api/users/${bob.id}/debts`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      userId: bob.id,
      totalOutstanding: 36,
      debts: [
        { expenseId: exp1.body.id, toUserId: alice.id, toUserName: "Alice", owed: 10, settled: 4, outstanding: 6 },
        { expenseId: exp2.body.id, toUserId: alice.id, toUserName: "Alice", owed: 20, settled: 0, outstanding: 20 },
        { expenseId: exp3.body.id, toUserId: carol.id, toUserName: "Carol", owed: 10, settled: 0, outstanding: 10 },
      ],
    });
  });

  test("excludes the payer's own share and returns an empty list when nothing is owed", async () => {
    const alice = await createUser("Alice", 100);
    const bob = await createUser("Bob", 0);
    await request(app).post("/api/expenses").send({
      payerId: alice.id,
      participantIds: [alice.id, bob.id],
      totalAmount: 10,
    });

    const res = await request(app).get(`/api/users/${alice.id}/debts`);
    expect(res.body).toEqual({ userId: alice.id, totalOutstanding: 0, debts: [] });
  });

  test("404s for an unknown user", async () => {
    const res = await request(app).get("/api/users/ghost/debts");
    expect(res.status).toBe(404);
  });
});

describe("Group expenses - custom split", () => {
  test("accepts a custom split whose amounts sum to the total", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
      splitType: "custom",
      splits: [
        { userId: payer.id, amount: 60 },
        { userId: bob.id, amount: 40 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.splits).toEqual(
      expect.arrayContaining([
        { userId: payer.id, amount: 60 },
        { userId: bob.id, amount: 40 },
      ])
    );
  });

  test("rejects a custom split that doesn't sum to the total", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
      splitType: "custom",
      splits: [
        { userId: payer.id, amount: 60 },
        { userId: bob.id, amount: 30 },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Split total/i);
  });

  test("rejects a custom split referencing a non-participant", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);
    const stranger = await createUser("Stranger", 0);

    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
      splitType: "custom",
      splits: [
        { userId: payer.id, amount: 60 },
        { userId: stranger.id, amount: 40 },
      ],
    });

    expect(res.status).toBe(400);
  });

  test("rejects a custom split that leaves a participant out", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);

    const res = await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
      splitType: "custom",
      splits: [{ userId: payer.id, amount: 100 }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/exactly one split entry/i);
  });

  test("does not debit the payer when a custom split is rejected", async () => {
    const payer = await createUser("Payer", 100);
    const bob = await createUser("Bob", 0);

    await request(app).post("/api/expenses").send({
      payerId: payer.id,
      participantIds: [payer.id, bob.id],
      totalAmount: 100,
      splitType: "custom",
      splits: [{ userId: payer.id, amount: 1 }, { userId: bob.id, amount: 1 }],
    });

    const balance = await request(app).get(`/api/users/${payer.id}/balance`);
    expect(balance.body.balance).toBe(100);
    const history = await request(app).get(`/api/users/${payer.id}/transactions`);
    expect(history.body.map((t) => t.type)).toEqual(["INITIAL_BALANCE"]);
  });
});
