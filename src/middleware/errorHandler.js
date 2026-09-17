const AppError = require("../errors/AppError");

// Express identifies error middleware by its four-argument signature.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  console.error("Unexpected error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = errorHandler;
