// /api/incidents -> SOS button and the incident workflow: Reported -> Assigned -> Resolved
const express = require('express');
const Incident = require('../models/Incident');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { emitToAdmins, emitToUser } = require('../socket');
const { sendAlert, notifyTourist } = require('../services/alerts');
const { isValidLatLng } = require('../utils/validate');
const { computeIncidentHash } = require('../utils/incidentHash');
const { logIncidentHash } = require('../services/blockchain');

const router = express.Router();

// ----- Duplicate SOS protection -----
// A tourist in panic may press SOS many times. Presses within 30 s of the last SOS are ignored.
const SOS_COOLDOWN_MS = 30 * 1000;
const lastSos = new Map(); // touristId -> { at: time of last SOS, incidentId }

// The only allowed next status for each status (no skipping, no going back)
const NEXT_STATUS = { Reported: 'Assigned', Assigned: 'Resolved', Resolved: null };

// Fields to fill in from other collections when sending an incident to the browser
const POPULATE = [
  { path: 'touristId', select: 'name phone nationality emergencyContact' },
  { path: 'history.by', select: 'name role' },
];

// Send the latest version of an incident to every admin and to the tourist who raised it
async function broadcastIncident(incidentId) {
  const incident = await Incident.findById(incidentId).populate(POPULATE).lean();
  emitToAdmins('incident', incident);
  emitToUser(String(incident.touristId._id), 'incident', incident);
  return incident;
}

// Logs the hash of the incident's current state on the blockchain and saves the proof in MongoDB.
// Safety first: if the chain is down, the SOS still works and the incident is simply marked as not logged.
async function logOnChain(incidentId) {
  const incident = await Incident.findById(incidentId).lean();
  const hash = computeIncidentHash(incident);
  try {
    const txHash = await logIncidentHash(hash);
    await Incident.updateOne({ _id: incidentId }, { chainHash: hash, chainTxHash: txHash, chainLoggedAt: new Date() });
  } catch (err) {
    console.warn(`[chain] incident ${incidentId} not logged: ${err.message}`);
    await Incident.updateOne({ _id: incidentId }, { chainHash: null, chainTxHash: null, chainLoggedAt: null });
  }
}

// POST /api/incidents/sos  body: { lat, lng, message }  (lat/lng optional: falls back to the last known position)
router.post('/sos', requireAuth, requireRole('tourist'), async (req, res) => {
  const userId = req.user.id;
  const now = Date.now();

  // 1. Ignore a repeat SOS within 30 s
  const previous = lastSos.get(userId);
  if (previous && now - previous.at < SOS_COOLDOWN_MS) {
    const wait = Math.ceil((SOS_COOLDOWN_MS - (now - previous.at)) / 1000);
    return res.json({
      duplicate: true,
      incidentId: previous.incidentId,
      message: `SOS already sent, help is on the way. You can send another in ${wait}s.`,
    });
  }
  // Recorded BEFORE any await: Node runs this synchronously, so two presses arriving together cannot both pass
  lastSos.set(userId, { at: now });

  try {
    // 2. Where is the tourist? Use the position sent with the SOS, otherwise the last tracked position.
    const user = await User.findById(userId).lean();
    const { lat, lng } = req.body;
    let coordinates = null;
    if (isValidLatLng(lat, lng)) coordinates = [lng, lat];
    else if (user?.lastLocation?.coordinates?.length === 2) coordinates = user.lastLocation.coordinates;

    if (!user || !coordinates) {
      lastSos.delete(userId); // nothing was saved, so do not block the next attempt
      return res.status(400).json({ message: 'Your location is unknown. Share GPS or start the simulator, then try again.' });
    }

    // 3. Save the incident with its first history entry
    const message = String(req.body.message || '').trim().slice(0, 300);
    const incident = await Incident.create({
      touristId: userId,
      type: 'SOS',
      message,
      location: { type: 'Point', coordinates },
      history: [{ status: 'Reported', by: userId, note: 'SOS button pressed' }],
    });
    lastSos.set(userId, { at: now, incidentId: incident._id });

    // 4. Notify: pop-up alert for admins + the tourist, and the full incident for the incident lists
    sendAlert({
      kind: 'SOS',
      severity: 'critical',
      title: 'SOS EMERGENCY',
      message: `${user.name} pressed SOS${message ? `: "${message}"` : ''}`,
      touristMessage: 'SOS sent. The control room has your location.',
      touristId: userId,
      touristName: user.name,
      incidentId: incident._id.toString(),
      lat: coordinates[1],
      lng: coordinates[0],
    });
    await logOnChain(incident._id); // after the alert, so the blockchain never delays the emergency pop-up
    const populated = await broadcastIncident(incident._id);
    res.status(201).json({ incident: populated });
  } catch (err) {
    lastSos.delete(userId);
    throw err; // handled by the central error handler
  }
});

// GET /api/incidents?status=Reported  -> admins see all incidents, a tourist sees only their own
router.get('/', requireAuth, async (req, res) => {
  const filter = req.user.role === 'admin' ? {} : { touristId: req.user.id };
  if (req.query.status) filter.status = String(req.query.status);
  const incidents = await Incident.find(filter).sort({ createdAt: -1 }).limit(200).populate(POPULATE).lean();
  res.json({ incidents });
});

// PATCH /api/incidents/:id/status  body: { status, assignedTo, note }  (Admin/Police only)
router.patch('/:id/status', requireAuth, requireRole('admin'), async (req, res) => {
  const { status, assignedTo, note } = req.body;
  const incident = await Incident.findById(req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });

  // Enforce the workflow order
  const allowed = NEXT_STATUS[incident.status];
  if (status !== allowed) {
    return res.status(400).json({
      message: `Cannot change status from ${incident.status} to ${status}. Allowed next: ${allowed || 'none (already resolved)'}`,
    });
  }
  const officer = String(assignedTo || '').trim();
  if (status === 'Assigned' && !officer) {
    return res.status(400).json({ message: 'Enter the officer or unit being assigned' });
  }

  const changes = { status };
  if (status === 'Assigned') changes.assignedTo = officer;
  const historyEntry = { status, by: req.user.id, note: String(note || '').trim() || undefined, at: new Date() };

  // Atomic update that only matches if the status is still what we read above.
  // If two officers click at the same moment, the second one gets a 409 instead of a double update.
  const updated = await Incident.findOneAndUpdate(
    { _id: incident._id, status: incident.status },
    { $set: changes, $push: { history: historyEntry } },
    { new: true }
  );
  if (!updated) return res.status(409).json({ message: 'Someone else updated this incident first. Please check again.' });

  notifyTourist(
    incident.touristId,
    status === 'Assigned' ? 'Help is assigned' : 'Incident resolved',
    status === 'Assigned' ? `${officer} is handling your emergency.` : 'Your incident has been marked as resolved. Stay safe!'
  );
  await logOnChain(updated._id); // every new state gets its own hash on chain
  const populated = await broadcastIncident(updated._id);
  res.json({ incident: populated });
});

module.exports = router;
