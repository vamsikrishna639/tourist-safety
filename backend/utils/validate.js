// Shared input checks

// True only for real numbers inside the valid latitude/longitude range (strings like "17.3" are rejected)
function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

module.exports = { isValidLatLng };
