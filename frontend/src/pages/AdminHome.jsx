// Admin/Police dashboard: live map of every tourist over the geo-fence zones, plus recent alerts.
// Positions and alerts arrive over Socket.IO, no page refresh needed.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet';
import MapView from '../components/MapView';
import ZoneLayer from '../components/ZoneLayer';
import { api } from '../api';
import { useSocketEvent } from '../SocketContext';
import { useZones } from '../useZones';
import { useIncidents } from '../useIncidents';
import { timeAgo, toLatLng, ZONE_INFO } from '../utils';

const TRAIL_LENGTH = 30; // recent points drawn behind each tourist
const STALE_AFTER_MS = 30000; // no update for 30 s -> shown grey
const STALE_COLOR = '#94a3b8';

// Convert a tourist from the REST API into the shape this page uses
function fromApi(t) {
  return {
    userId: t._id,
    name: t.name,
    nationality: t.nationality,
    emergencyContact: t.emergencyContact,
    position: toLatLng(t.lastLocation), // [lat, lng] or null
    timestamp: t.lastSeenAt,
    source: null,
    zoneId: t.lastZoneId,
    zoneType: t.lastZoneType || 'none',
    trail: [],
  };
}

// Combine two alert lists, drop duplicates, newest first
function mergeAlerts(a, b) {
  const byId = new Map();
  for (const alert of [...a, ...b]) byId.set(alert.id, alert);
  return [...byId.values()].sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp)).slice(0, 50);
}

export default function AdminHome() {
  const { zones } = useZones();
  const { incidents } = useIncidents();
  const [tourists, setTourists] = useState({}); // { userId: tourist }
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  // 1. Load tourists (with their last saved position) and recent alerts once
  useEffect(() => {
    api('/tourists')
      .then((data) =>
        setTourists((prev) => {
          const next = { ...prev };
          // keep any live data that already arrived over the socket
          for (const t of data.tourists) next[t._id] = { ...fromApi(t), ...prev[t._id] };
          return next;
        })
      )
      .catch((err) => setError(err.message));

    api('/tourists/alerts')
      .then((data) => setAlerts((prev) => mergeAlerts(prev, data.alerts)))
      .catch((err) => setError(err.message));
  }, []);

  // 2. Live updates pushed by the server
  useSocketEvent('location:update', (u) => {
    setTourists((prev) => {
      const old = prev[u.userId] || { trail: [] };
      const position = [u.lat, u.lng];
      return {
        ...prev,
        [u.userId]: {
          ...old,
          userId: u.userId,
          name: u.name,
          position,
          timestamp: u.timestamp,
          source: u.source,
          zoneId: u.zoneId,
          zoneType: u.zoneType,
          trail: [...old.trail, position].slice(-TRAIL_LENGTH),
        },
      };
    });
  });

  useSocketEvent('alert', (alert) => setAlerts((prev) => mergeAlerts([alert], prev)));

  // 3. Re-render every 5 s so "last seen" text and grey markers stay correct
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const zoneById = Object.fromEntries(zones.map((z) => [z._id, z]));
  const zoneName = (t) => zoneById[t.zoneId]?.name || ZONE_INFO[t.zoneType || 'none'].label;
  const list = Object.values(tourists).sort((a, b) => a.name.localeCompare(b.name));
  const isActive = (t) => t.timestamp && now - new Date(t.timestamp) < STALE_AFTER_MS;
  const markerColor = (t) => (isActive(t) ? ZONE_INFO[t.zoneType || 'none'].color : STALE_COLOR);
  const openIncidents = incidents.filter((i) => i.status !== 'Resolved');

  return (
    <div className="page">
      <div className="page-header">
        <h2>Live Tourist Map</h2>
        <span className="hint">{list.filter(isActive).length} of {list.length} tourists active</span>
        {openIncidents.length > 0 && (
          <Link to="/admin/incidents" className="badge badge-sos">{openIncidents.length} open incident(s)</Link>
        )}
      </div>
      {error && <p className="error">{error}</p>}

      <div className="dashboard">
        <div>
          <MapView>
            <ZoneLayer zones={zones} />
            {list.map((t) => (
              <Polyline key={`trail-${t.userId}`} positions={t.trail} pathOptions={{ color: '#1e293b', weight: 2, opacity: 0.4 }} />
            ))}
            {list
              .filter((t) => t.position)
              .map((t) => (
                <CircleMarker
                  key={t.userId}
                  center={t.position}
                  radius={9}
                  pathOptions={{ color: 'white', weight: 2, fillColor: markerColor(t), fillOpacity: 1 }}
                >
                  <Popup>
                    <b>{t.name}</b> {t.nationality && `(${t.nationality})`}
                    <br />Zone: {zoneName(t)}
                    <br />Last seen: {timeAgo(t.timestamp, now)} {t.source && `via ${t.source}`}
                  </Popup>
                </CircleMarker>
              ))}
            {/* Open SOS incidents: big red ring where the SOS was pressed */}
            {openIncidents.map((i) => (
              <CircleMarker
                key={i._id}
                center={toLatLng(i.location)}
                radius={18}
                pathOptions={{ color: '#dc2626', weight: 3, dashArray: '4', fillColor: '#dc2626', fillOpacity: 0.15 }}
              >
                <Tooltip permanent direction="top">SOS: {i.touristId?.name} ({i.status})</Tooltip>
              </CircleMarker>
            ))}
          </MapView>
          <div className="legend">
            {Object.entries(ZONE_INFO).map(([type, info]) => (
              <span key={type}><span className="dot" style={{ background: info.color }} /> {info.label}</span>
            ))}
            <span><span className="dot" style={{ background: STALE_COLOR }} /> No update for 30s</span>
          </div>
        </div>

        <div className="card alerts-panel">
          <h3>Alerts ({alerts.length})</h3>
          {alerts.length === 0 && <p className="hint">No alerts yet. They appear on SOS or when a tourist enters a red or yellow zone.</p>}
          {alerts.map((a) => (
            <div key={a.id} className={`alert-item alert-${a.severity}`}>
              <b>{a.title}</b>
              <div>{a.message}</div>
              <div className="hint">{timeAgo(a.timestamp, now)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card wide" style={{ marginTop: 16 }}>
        <table className="list">
          <thead>
            <tr><th>Name</th><th>Nationality</th><th>Status</th><th>Zone</th><th>Last seen</th><th>Source</th><th>Emergency contact</th></tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.userId}>
                <td>{t.name}</td>
                <td>{t.nationality || '-'}</td>
                <td>
                  {!t.position ? <span className="badge badge-off">no data</span>
                    : isActive(t) ? <span className="badge badge-ok">active</span>
                    : <span className="badge badge-off">stale</span>}
                </td>
                <td>
                  <span className="dot" style={{ background: ZONE_INFO[t.zoneType || 'none'].color }} /> {zoneName(t)}
                </td>
                <td>{timeAgo(t.timestamp, now)}</td>
                <td>{t.source || '-'}</td>
                <td>{t.emergencyContact ? `${t.emergencyContact.name}, ${t.emergencyContact.phone}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
