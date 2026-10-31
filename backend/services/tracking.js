// Location pipeline: every GPS point (browser or simulator) goes through recordLocation().
// Steps: find zone -> save -> alert on zone change -> push to dashboards. Stage 6 adds the safety score.
const Location = require('../models/Location');
const User = require('../models/User');
const { emitToAdmins, emitToUser } = require('../socket');
const { findZone, shouldAlert, getZones } = require('./geofence');
const { zoneEntryAlert } = require('./alerts');

async function recordLocation(userId, { lat, lng, source }) {
  // Read the user BEFORE updating, so we still know which zone they were in last time
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const point = { type: 'Point', coordinates: [lng, lat] }; // GeoJSON order is [lng, lat]
  const timestamp = new Date();

  // 1. Geo-fence check with Turf.js
  const zone = findZone([lng, lat], await getZones());
  const zoneId = zone ? zone._id : null;
  const zoneType = zone ? zone.type : 'none';

  // 2. Save current state on the user, and the history point
  await User.updateOne(
    { _id: userId },
    { lastLocation: point, lastSeenAt: timestamp, lastZoneId: zoneId, lastZoneType: zoneType }
  );
  await Location.create({ userId, location: point, source, timestamp, zoneId, zoneType });

  // 3. Alert only on a CHANGE into a red/yellow zone, not on every update
  if (shouldAlert(user.lastZoneId, zone)) zoneEntryAlert(user, zone, lat, lng);

  // 4. Push the update to admin dashboards and to the tourist's own page
  const update = {
    userId: user._id.toString(),
    name: user.name,
    lat,
    lng,
    source,
    timestamp,
    zoneId: zoneId ? zoneId.toString() : null,
    zoneName: zone ? zone.name : null,
    zoneType,
  };
  emitToAdmins('location:update', update);
  emitToUser(update.userId, 'location:self', update);

  return update;
}

module.exports = { recordLocation };
