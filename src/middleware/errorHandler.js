const AppError = require("../errors/AppError");

/**
 * Central error handler. Express recognises error middleware by its arity,
 * so all four parameters must stay even though `next` is unused.
 *
 * Every route handler in this app is synchronous, so thrown AppErrors land
 * here automatically via Express's default synchronous error handling.
 * Unexpected (non-AppError) exceptions are logged and returned as a generic
 * 500 so internal details never leak to the client.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // express.json() rejects unparseable bodies with this error type. That is
  // the client's fault, not ours, so report it as 400 rather than 500.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }

  console.error("Unexpected error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = errorHandler;
