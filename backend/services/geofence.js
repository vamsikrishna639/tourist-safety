// Geo-fencing: which zone is a point in, and should we raise an alert?
// findZone() and shouldAlert() are pure functions (no database), so they are easy to unit test in Stage 7.
const { booleanPointInPolygon } = require('@turf/boolean-point-in-polygon');
const Zone = require('../models/Zone');

// When zones overlap, the most dangerous one wins
const ZONE_PRIORITY = { red: 3, yellow: 2, green: 1 };
const ALERT_TYPES = ['red', 'yellow'];

// point = [lng, lat]. Returns the zone that contains the point, or null if it is outside every zone.
function findZone(point, zones) {
  let best = null;
  for (const zone of zones) {
    if (booleanPointInPolygon(point, zone.geometry)) {
      if (!best || ZONE_PRIORITY[zone.type] > ZONE_PRIORITY[best.type]) best = zone;
    }
  }
  return best;
}

// Alert only when the tourist moves INTO a different zone that is red or yellow.
// Staying inside the same zone, or entering a green zone, does not alert.
function shouldAlert(previousZoneId, newZone) {
  if (!newZone || !ALERT_TYPES.includes(newZone.type)) return false;
  return String(newZone._id) !== String(previousZoneId);
}

// ----- Zone cache -----
// Locations arrive every few seconds, so we keep the zones in memory instead of querying MongoDB each time.
// The cache is cleared whenever an admin changes a zone, and refreshed every minute anyway (e.g. after a re-seed).
const CACHE_MS = 60 * 1000;
let cachedZones = null;
let cachedAt = 0;

async function getZones() {
  if (!cachedZones || Date.now() - cachedAt > CACHE_MS) {
    cachedZones = await Zone.find().lean();
    cachedAt = Date.now();
  }
  return cachedZones;
}

function clearZoneCache() {
  cachedZones = null;
}

module.exports = { findZone, shouldAlert, getZones, clearZoneCache, ZONE_PRIORITY };
