const AppError = require("../errors/AppError");
const { fail } = require("../utils/response");

// Express identifies error middleware by its four-argument signature.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof AppError) {
    return fail(res, err.message, err.statusCode);
  }
  if (err.type === "entity.parse.failed") {
    return fail(res, "Request body is not valid JSON", 400);
  }
  console.error("Unexpected error:", err);
  return fail(res, "Internal server error", 500);
}

module.exports = errorHandler;
