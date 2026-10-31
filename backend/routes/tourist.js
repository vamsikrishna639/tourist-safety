// /api/tourists -> tourist data and live location updates
const express = require('express');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordLocation } = require('../services/tracking');
const { getRecentAlerts } = require('../services/alerts');
const { isValidLatLng } = require('../utils/validate');

const router = express.Router();

// GET /api/tourists -> list all tourists with their last known position (Admin/Police only)
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  const tourists = await User.find({ role: 'tourist' }).sort({ name: 1 });
  res.json({ tourists });
});

// GET /api/tourists/alerts -> the latest alerts, so a freshly opened dashboard is not empty (Admin/Police only)
router.get('/alerts', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ alerts: getRecentAlerts() });
});

// POST /api/tourists/location  body: { lat, lng, source }
// Sent by the tourist's browser (GPS) or by the simulator, always with the tourist's own JWT.
router.post('/location', requireAuth, requireRole('tourist'), async (req, res) => {
  const { lat, lng } = req.body;

  if (!isValidLatLng(lat, lng)) {
    return res.status(400).json({ message: 'lat and lng must be valid numbers' });
  }
  const source = req.body.source === 'simulator' ? 'simulator' : 'gps';

  const update = await recordLocation(req.user.id, { lat, lng, source });
  if (!update) return res.status(404).json({ message: 'User no longer exists' });
  res.status(201).json(update);
});

module.exports = router;
