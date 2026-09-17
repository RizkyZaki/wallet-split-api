// Expected failures (validation, not found, insufficient balance). The error
// handler maps these to their status code; anything else becomes a 500.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
