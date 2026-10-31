// Small display helpers shared by several pages

export const formatDate = (d) => new Date(d).toLocaleDateString();

// "12s ago", "3 min ago", or the full date for older times
export function timeAgo(date, now = Date.now()) {
  if (!date) return 'never';
  const seconds = Math.max(0, Math.round((now - new Date(date)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return new Date(date).toLocaleString();
}

// GeoJSON stores [lng, lat] but Leaflet wants [lat, lng]. Returns null if there is no position yet.
export function toLatLng(geoPoint) {
  const c = geoPoint?.coordinates;
  return c?.length === 2 ? [c[1], c[0]] : null;
}

// Same conversion for a GeoJSON Polygon: rings of [lng, lat] -> rings of [lat, lng]
export const polygonToLatLngs = (geometry) => geometry.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng]));

// Colour and label for each zone type ("none" = outside every zone)
export const ZONE_INFO = {
  red: { color: '#dc2626', label: 'Restricted' },
  yellow: { color: '#f59e0b', label: 'Caution' },
  green: { color: '#16a34a', label: 'Safe' },
  none: { color: '#2563eb', label: 'Outside zones' },
};

// Colour for each incident status
export const STATUS_INFO = {
  Reported: { color: '#dc2626' },
  Assigned: { color: '#d97706' },
  Resolved: { color: '#16a34a' },
};
