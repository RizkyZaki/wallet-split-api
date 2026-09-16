const express = require("express");
const userRoutes = require("./routes/userRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const errorHandler = require("./middleware/errorHandler");

function createApp() {
  const app = express();
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api", userRoutes);
  app.use("/api", expenseRoutes);

  app.use((req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
