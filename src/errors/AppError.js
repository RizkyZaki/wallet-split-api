/**
 * AppError is used for all *expected* failure cases (validation problems,
 * missing users, insufficient balance, etc). Keeping this as a distinct
 * class lets the central error handler tell "the caller did something
 * wrong" (4xx) apart from unexpected bugs (5xx).
 */
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
