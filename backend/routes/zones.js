// /api/zones -> geo-fence zones. Everyone logged in can read them, only admins can change them.
const express = require('express');
const Zone = require('../models/Zone');
const { requireAuth, requireRole } = require('../middleware/auth');
const { clearZoneCache } = require('../services/geofence');
const { emitToAll } = require('../socket');

const router = express.Router();

// A GeoJSON polygon needs at least 4 points in its outer ring (a triangle + the closing point)
function isPolygon(geometry) {
  return geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates?.[0]) && geometry.coordinates[0].length >= 4;
}

// After any change: forget the cached zones and tell every open map to reload
function zonesChanged() {
  clearZoneCache();
  emitToAll('zones:changed');
}

// GET /api/zones
router.get('/', requireAuth, async (req, res) => {
  const zones = await Zone.find().sort({ type: 1, name: 1 });
  res.json({ zones });
});

// POST /api/zones  body: { name, type, description, geometry }  (geometry comes from leaflet-draw)
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  const { name, type, description, geometry } = req.body;
  if (!isPolygon(geometry)) {
    return res.status(400).json({ message: 'geometry must be a GeoJSON Polygon' });
  }
  const zone = await Zone.create({
    name,
    type,
    description,
    geometry: { type: 'Polygon', coordinates: geometry.coordinates },
    createdBy: req.user.id,
  });
  zonesChanged();
  res.status(201).json({ zone });
});

// PUT /api/zones/:id  body: any of { name, type, description }. To change the shape, delete and redraw.
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const changes = {};
  for (const field of ['name', 'type', 'description']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }
  const zone = await Zone.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!zone) return res.status(404).json({ message: 'Zone not found' });
  zonesChanged();
  res.json({ zone });
});

// DELETE /api/zones/:id
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  const zone = await Zone.findByIdAndDelete(req.params.id);
  if (!zone) return res.status(404).json({ message: 'Zone not found' });
  zonesChanged();
  res.json({ message: 'Zone deleted' });
});

module.exports = router;
