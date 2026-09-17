const AppError = require("../errors/AppError");
const money = require("./money");

function assertAmount(value, field) {
  if (!money.isValidAmount(value)) {
    throw new AppError(`'${field}' must be a positive number with at most 2 decimal places`);
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(`'${field}' is required and must be a non-empty string`);
  }
}

module.exports = { assertAmount, assertNonEmptyString };
