const express = require("express");
const userRoutes = require("./routes/userRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const errorHandler = require("./middleware/errorHandler");
const { ok, fail } = require("./utils/response");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => ok(res, { status: "ok" }));

  app.use("/api", userRoutes);
  app.use("/api", expenseRoutes);

  app.use((req, res) => fail(res, "Not found", 404));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
