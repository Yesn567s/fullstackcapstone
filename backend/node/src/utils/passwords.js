const bcrypt = require('bcrypt');

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function verifyPassword(password, storedHash) {
  const compatibleHash = storedHash.replace(/^\$2y\$/, '$2b$');
  return bcrypt.compare(password, compatibleHash);
}

module.exports = { hashPassword, verifyPassword };
