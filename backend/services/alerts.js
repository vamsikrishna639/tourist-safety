// In-app alerts pushed over Socket.IO. Alerts are short-lived notifications;
// incidents (Stage 4) are the records that are saved and worked on.
const { emitToAdmins, emitToUser } = require('../socket');

const MAX_RECENT = 50;
const recentAlerts = []; // newest first, kept in memory (cleared when the server restarts)

// Every kind of alert (zone entry now, anomalies in Stage 6) goes through here
function sendAlert(alert) {
  const full = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(),
    ...alert,
  };
  recentAlerts.unshift(full);
  if (recentAlerts.length > MAX_RECENT) recentAlerts.pop();

  emitToAdmins('alert', full); // every admin/police dashboard
  if (full.touristId) emitToUser(full.touristId, 'alert', full); // the tourist concerned
  return full;
}

function zoneEntryAlert(user, zone, lat, lng) {
  const restricted = zone.type === 'red';
  return sendAlert({
    kind: 'ZONE_ENTRY',
    severity: restricted ? 'high' : 'medium',
    title: restricted ? 'Restricted zone entered' : 'Caution zone entered',
    message: `${user.name} entered ${restricted ? 'RESTRICTED' : 'caution'} zone "${zone.name}"`,
    touristMessage: restricted
      ? `You entered a restricted area: ${zone.name}. Please leave immediately.`
      : `Caution: ${zone.name}. ${zone.description || 'Stay alert.'}`,
    touristId: user._id.toString(),
    touristName: user.name,
    zoneName: zone.name,
    zoneType: zone.type,
    lat,
    lng,
  });
}

// A personal notification for one tourist only (e.g. "help assigned"). Not shown to admins, not kept in the list.
function notifyTourist(touristId, title, message, kind = 'INFO') {
  emitToUser(String(touristId), 'alert', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(),
    kind,
    severity: 'info',
    title,
    message,
    touristMessage: message,
  });
}

const getRecentAlerts = () => recentAlerts;

module.exports = { sendAlert, zoneEntryAlert, notifyTourist, getRecentAlerts };
