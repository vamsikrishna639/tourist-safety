// /api/auth -> register, login, and "who am I"
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const config = require('../config');
const { signToken, requireAuth } = require('../middleware/auth');
const { createSalt, computeIdHash } = require('../utils/digitalId');
const { registerId } = require('../services/blockchain');

const router = express.Router();

// POST /api/auth/register  (tourists only; the admin account comes from the seed script)
router.post('/register', async (req, res) => {
  const { name, email, password, phone, govtId, nationality, tripStart, tripEnd, emergencyContact } = req.body;

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  // role is forced to "tourist" so nobody can register themselves as admin
  const user = new User({ name, email, phone, govtId, nationality, tripStart, tripEnd, emergencyContact, role: 'tourist' });
  user.passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  // Check required fields, dates and email before anything goes on the blockchain
  await user.validate();
  if (await User.exists({ email: user.email })) {
    return res.status(409).json({ message: 'email already exists' });
  }

  // Digital ID: random salt + SHA-256 hash of the details. Only the hash is sent to the blockchain.
  user.salt = createSalt();
  user.idHash = computeIdHash(user, user.salt);
  // Register on chain BEFORE saving: if the chain is down this throws (503) and nothing is saved, so the tourist can retry
  user.idTxHash = await registerId(user.idHash);

  await user.save(); // a duplicate email (two signups at once) still throws 11000 -> 409
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  // passwordHash has select:false, so we ask for it explicitly here.
  // String() blocks NoSQL injection like {"email": {"$gt": ""}}
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');

  // Same message for "no such user" and "wrong password", so attackers cannot discover valid emails
  if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  res.json({ token: signToken(user), user });
});

// GET /api/auth/me -> the logged-in user's profile (frontend calls this on page refresh)
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: 'User no longer exists' });
  res.json({ user });
});

module.exports = router;
