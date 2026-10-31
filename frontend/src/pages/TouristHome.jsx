// Tourist dashboard: own position on the zone map, current zone, browser GPS sharing, profile.
import { useEffect, useRef, useState } from 'react';
import { CircleMarker, Popup } from 'react-leaflet';
import MapView, { HYDERABAD } from '../components/MapView';
import ZoneLayer from '../components/ZoneLayer';
import PanTo from '../components/PanTo';
import SosButton from '../components/SosButton';
import DigitalIdCard from '../components/DigitalIdCard';
import { useAuth } from '../AuthContext';
import { useSocketEvent } from '../SocketContext';
import { useZones } from '../useZones';
import { useIncidents } from '../useIncidents';
import { api } from '../api';
import { formatDate, timeAgo, toLatLng, STATUS_INFO, ZONE_INFO } from '../utils';

const SEND_EVERY_MS = 5000; // GPS can fire many times a second; send at most one update per 5 s

const GPS_ERRORS = {
  1: 'Location permission denied. Allow location for localhost in the browser (padlock icon), or use the simulator.',
  2: 'Position unavailable (no GPS or Wi-Fi location on this PC). Use the simulator for the demo.',
  3: 'Timed out waiting for GPS. Use the simulator for the demo.',
};

export default function TouristHome() {
  const { user } = useAuth();
  const { zones } = useZones();
  const { incidents } = useIncidents(); // only this tourist's own incidents
  const [position, setPosition] = useState(toLatLng(user.lastLocation)); // [lat, lng] or null
  const [zone, setZone] = useState({ id: user.lastZoneId, type: user.lastZoneType || 'none' });
  const [lastUpdate, setLastUpdate] = useState(user.lastSeenAt ? { time: user.lastSeenAt, source: 'saved' } : null);
  const [sharing, setSharing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const watchId = useRef(null); // id returned by watchPosition, needed to stop it
  const lastSent = useRef(0); // time of the last update sent to the server

  // Updates for this tourist (from the simulator or this tab's GPS) come back on our private socket room
  useSocketEvent('location:self', (u) => {
    setPosition([u.lat, u.lng]);
    setZone({ id: u.zoneId, type: u.zoneType });
    setLastUpdate({ time: u.timestamp, source: u.source });
  });

  // Stop GPS when the tourist leaves this page
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  function startSharing() {
    if (!navigator.geolocation) {
      setGpsStatus('This browser does not support geolocation.');
      return;
    }
    setGpsStatus('Waiting for GPS...');
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPosition([lat, lng]);

        if (Date.now() - lastSent.current < SEND_EVERY_MS) return; // throttle
        lastSent.current = Date.now();
        try {
          await api('/tourists/location', { method: 'POST', body: { lat, lng, source: 'gps' } });
          setGpsStatus(`Sharing. Accuracy about ${Math.round(pos.coords.accuracy)} m.`);
        } catch (err) {
          setGpsStatus(err.message);
        }
      },
      (err) => {
        setGpsStatus(GPS_ERRORS[err.code] || err.message);
        stopSharing();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setSharing(true);
  }

  function stopSharing() {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
  }

  const zoneInfo = ZONE_INFO[zone.type || 'none'];
  const currentZone = zones.find((z) => z._id === zone.id);

  return (
    <div className="dashboard">
      <div>
        <MapView center={position || HYDERABAD} zoom={15}>
          <ZoneLayer zones={zones} />
          {position && (
            <CircleMarker center={position} radius={10} pathOptions={{ color: 'white', weight: 3, fillColor: '#1e293b', fillOpacity: 1 }}>
              <Popup>You are here</Popup>
            </CircleMarker>
          )}
          <PanTo position={position} />
        </MapView>
      </div>

      <div className="side">
        <SosButton position={position} />

        <div className="card zone-status" style={{ borderLeft: `6px solid ${zoneInfo.color}` }}>
          <h3>Current zone</h3>
          <p className="zone-big" style={{ color: zoneInfo.color }}>{zoneInfo.label}</p>
          {currentZone && <p><b>{currentZone.name}</b>{currentZone.description && `: ${currentZone.description}`}</p>}
        </div>

        <DigitalIdCard />

        <div className="card">
          <h3>Live location</h3>
          <p>{lastUpdate ? `Last update ${timeAgo(lastUpdate.time)} (${lastUpdate.source})` : 'No location yet.'}</p>
          {sharing ? (
            <button className="btn-danger" onClick={stopSharing}>Stop sharing GPS</button>
          ) : (
            <button onClick={startSharing}>Share my GPS location</button>
          )}
          {gpsStatus && <p className="hint">{gpsStatus}</p>}
          <p className="hint">For the demo, run the simulator; this map then follows your simulated position.</p>
        </div>

        {incidents.length > 0 && (
          <div className="card">
            <h3>My incidents</h3>
            {incidents.slice(0, 5).map((i) => (
              <div key={i._id} className="zone-row">
                <span className="badge" style={{ background: STATUS_INFO[i.status].color, color: 'white' }}>{i.status}</span>
                <span className="zone-name">
                  {i.type} {timeAgo(i.createdAt)}
                  {i.assignedTo && <><br /><span className="hint">Handled by {i.assignedTo}</span></>}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h3>{user.name}</h3>
          <table className="details">
            <tbody>
              <tr><th>Email</th><td>{user.email}</td></tr>
              <tr><th>Trip</th><td>{formatDate(user.tripStart)} to {formatDate(user.tripEnd)}</td></tr>
              <tr>
                <th>Emergency</th>
                <td>{user.emergencyContact?.name}, {user.emergencyContact?.phone}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
