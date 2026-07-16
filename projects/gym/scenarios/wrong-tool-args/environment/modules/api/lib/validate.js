/**
 * Request validation.
 */
function validateUser(body) {
  const errors = [];
  if (!body.name || typeof body.name !== "string") {
    errors.push("name is required and must be a string");
  }
  if (!body.email || typeof body.email !== "string") {
    errors.push("email is required and must be a string");
  }
  if (body.email && !body.email.includes("@")) {
    errors.push("email must contain @");
  }
  return errors;
}

module.exports = { validateUser };
