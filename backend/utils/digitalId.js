// Digital ID helpers. Only the hash produced here ever goes to the blockchain (Stage 5), never the raw details.
const crypto = require('crypto');

// 16 random bytes = 32 hex characters, different for every tourist
function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// SHA-256 of the tourist's identity details + salt.
// The fields are joined in a fixed order, so the same data always gives the same hash.
// Returns "0x" + 64 hex characters, which is exactly the bytes32 format the smart contract expects.
function computeIdHash(user, salt) {
  const data = [
    String(user.name).trim(),
    String(user.email).trim().toLowerCase(),
    String(user.govtId).trim(),
    new Date(user.tripStart).toISOString(),
    new Date(user.tripEnd).toISOString(),
    salt,
  ].join('|');
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = { createSalt, computeIdHash };
