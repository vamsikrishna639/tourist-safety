// SHA-256 fingerprint of an incident's full state. Logged on the blockchain after every change;
// the "Verify integrity" check recomputes it from MongoDB and looks for it on chain.
const crypto = require('crypto');

// Works for plain and populated documents (populated refs are objects with _id)
const idOf = (value) => String(value?._id ?? value);

function computeIncidentHash(incident) {
  // Fixed key order -> the same record always produces the same JSON text and the same hash.
  // updatedAt and the chain* fields are left out: they change when we save the chain proof itself.
  const data = {
    id: idOf(incident._id),
    touristId: idOf(incident.touristId),
    type: incident.type,
    message: incident.message || '',
    coordinates: incident.location.coordinates,
    status: incident.status,
    assignedTo: incident.assignedTo || '',
    history: incident.history.map((h) => ({
      status: h.status,
      by: idOf(h.by),
      note: h.note || '',
      at: new Date(h.at).toISOString(),
    })),
    createdAt: new Date(incident.createdAt).toISOString(),
  };
  return '0x' + crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

module.exports = { computeIncidentHash };
