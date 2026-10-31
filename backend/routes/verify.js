// /api/verify -> Digital ID QR, ID verification against the blockchain, revocation, incident integrity check
const express = require('express');
const QRCode = require('qrcode');
const User = require('../models/User');
const Incident = require('../models/Incident');
const { requireAuth, requireRole } = require('../middleware/auth');
const { computeIdHash } = require('../utils/digitalId');
const { computeIncidentHash } = require('../utils/incidentHash');
const chain = require('../services/blockchain');
const { notifyTourist } = require('../services/alerts');

const router = express.Router();

const QR_PREFIX = 'TSID:'; // marks our QR codes; the QR holds only the hash, no personal data
const isHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s);

// Details shown to the officer after a successful lookup
const touristCard = (u) => ({
  name: u.name,
  nationality: u.nationality,
  phone: u.phone,
  tripStart: u.tripStart,
  tripEnd: u.tripEnd,
  emergencyContact: u.emergencyContact,
});

// Runs every check on one Digital ID and returns { valid, verdict, checks[], tourist }
async function verifyDigitalId(idHash) {
  const user = await User.findOne({ idHash }).select('+salt').lean();
  const onChain = await chain.getIdStatus(idHash); // { registered, revoked, valid }

  if (!user) {
    return {
      valid: false,
      verdict: 'UNKNOWN ID',
      checks: [
        { label: 'Tourist record found in database', ok: false, detail: 'No tourist has this ID' },
        { label: 'Registered on blockchain', ok: onChain.registered },
      ],
    };
  }

  const untampered = computeIdHash(user, user.salt) === idHash; // recompute SHA-256(details + salt)
  const notExpired = new Date(user.tripEnd) >= new Date(); // expiry comes from tripEnd in MongoDB
  const checks = [
    { label: 'Tourist record found in database', ok: true, detail: user.name },
    {
      label: 'Record matches the ID hash',
      ok: untampered,
      detail: untampered ? 'SHA-256(details + salt) recomputed and matches' : 'Recomputed hash differs: the stored details were changed',
    },
    { label: 'Registered on blockchain', ok: onChain.registered },
    { label: 'Not revoked on blockchain', ok: !onChain.revoked },
    { label: 'Trip not expired', ok: notExpired, detail: `Trip ends ${new Date(user.tripEnd).toLocaleString()}` },
  ];

  let verdict = 'VALID';
  if (!untampered) verdict = 'TAMPERED';
  else if (!onChain.registered) verdict = 'NOT ON BLOCKCHAIN';
  else if (onChain.revoked) verdict = 'REVOKED';
  else if (!notExpired) verdict = 'EXPIRED';

  // onChain.valid is the contract's verifyID(): registered and not revoked
  return { valid: onChain.valid && untampered && notExpired, verdict, checks, tourist: touristCard(user) };
}

// GET /api/verify/my-id -> the logged-in tourist's QR code and current ID status
router.get('/my-id', requireAuth, requireRole('tourist'), async (req, res) => {
  const user = await User.findById(req.user.id).lean();
  if (!user) return res.status(404).json({ message: 'User no longer exists' });

  const qr = await QRCode.toDataURL(QR_PREFIX + user.idHash, { width: 260, margin: 1 }); // PNG as a data: URL
  let result;
  try {
    result = await verifyDigitalId(user.idHash);
  } catch (err) {
    result = { valid: false, verdict: 'BLOCKCHAIN OFFLINE', checks: [], error: err.message }; // still show the QR
  }
  res.json({ idHash: user.idHash, idTxHash: user.idTxHash, qr, result });
});

// GET /api/verify/chain -> is the blockchain reachable? (Admin)
router.get('/chain', requireAuth, requireRole('admin'), async (req, res) => {
  res.json(await chain.getChainStatus());
});

// GET /api/verify/id/:idHash -> verify a scanned Digital ID (Admin/Police)
router.get('/id/:idHash', requireAuth, requireRole('admin'), async (req, res) => {
  if (!isHash(req.params.idHash)) return res.status(400).json({ message: 'Not a valid Digital ID (expected 0x + 64 hex characters)' });
  res.json(await verifyDigitalId(req.params.idHash));
});

// POST /api/verify/id/:idHash/revoke -> revoke a Digital ID on the blockchain (Admin/Police)
router.post('/id/:idHash/revoke', requireAuth, requireRole('admin'), async (req, res) => {
  const { idHash } = req.params;
  if (!isHash(idHash)) return res.status(400).json({ message: 'Not a valid Digital ID' });
  const user = await User.findOne({ idHash });
  if (!user) return res.status(404).json({ message: 'No tourist has this ID' });

  await chain.revokeId(idHash); // the contract rejects unknown or already-revoked IDs
  await User.updateOne({ _id: user._id }, { idRevokedAt: new Date() }); // copy kept for chain:sync
  notifyTourist(
    user._id,
    'Digital ID revoked',
    'Your Digital ID was revoked by the authorities. Please contact the tourist help desk.',
    'ID_REVOKED' // lets the tourist's ID card reload itself
  );
  res.json(await verifyDigitalId(idHash));
});

// GET /api/verify/incident/:id -> recompute the incident hash from MongoDB and look for it on chain (Admin)
router.get('/incident/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const incident = await Incident.findById(req.params.id).lean();
  if (!incident) return res.status(404).json({ message: 'Incident not found' });

  const recomputed = computeIncidentHash(incident);
  const loggedAt = await chain.getIncidentLoggedAt(recomputed);
  const savedLoggedAt = incident.chainHash ? await chain.getIncidentLoggedAt(incident.chainHash) : 0;
  const matchesSaved = recomputed === incident.chainHash;

  const checks = [
    { label: 'Hash recomputed from the MongoDB record', ok: true, detail: recomputed },
    {
      label: 'Same as the hash saved when it was logged',
      ok: matchesSaved,
      detail: incident.chainHash ? `Saved: ${incident.chainHash}` : 'Never logged (blockchain was offline)',
    },
    {
      label: 'Recomputed hash exists on the blockchain',
      ok: loggedAt > 0,
      detail: loggedAt ? `Logged ${new Date(loggedAt * 1000).toLocaleString()}` : 'Not found on chain',
    },
  ];

  let verdict;
  if (loggedAt > 0 && matchesSaved) verdict = 'INTACT';
  else if (!incident.chainHash) verdict = 'NOT LOGGED';
  else if (savedLoggedAt === 0) verdict = 'PROOF MISSING'; // even the saved hash is gone: the chain was reset
  else verdict = 'TAMPERED'; // the saved proof is on chain, but the record no longer matches it

  res.json({ intact: verdict === 'INTACT', verdict, checks, chainTxHash: incident.chainTxHash });
});

module.exports = router;
