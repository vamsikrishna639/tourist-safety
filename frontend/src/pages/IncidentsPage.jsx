// Admin/Police incident desk: map of incidents + list with the Reported -> Assigned -> Resolved workflow
import { useState } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import MapView from '../components/MapView';
import PanTo from '../components/PanTo';
import CheckList from '../components/CheckList';
import { api } from '../api';
import { useIncidents } from '../useIncidents';
import { STATUS_INFO, timeAgo, toLatLng } from '../utils';

const FILTERS = ['Open', 'Reported', 'Assigned', 'Resolved', 'All']; // Open = not resolved yet

// Buttons to move an incident to its next status
function IncidentActions({ incident }) {
  const [officer, setOfficer] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (incident.status === 'Resolved') return null;
  const next = incident.status === 'Reported' ? 'Assigned' : 'Resolved';

  async function update() {
    setBusy(true);
    setError('');
    try {
      // The updated incident comes back over the socket, so the list refreshes by itself
      await api(`/incidents/${incident._id}/status`, { method: 'PATCH', body: { status: next, assignedTo: officer, note } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="actions" onClick={(e) => e.stopPropagation()}>
      {next === 'Assigned' && (
        <input placeholder="Officer / unit, e.g. Patrol Car 12" value={officer} onChange={(e) => setOfficer(e.target.value)} />
      )}
      <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button onClick={update} disabled={busy}>{next === 'Assigned' ? 'Assign' : 'Mark resolved'}</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// Blockchain proof + "Verify integrity": recompute the hash from MongoDB and look for it on chain
function IntegrityCheck({ incident }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError('');
    try {
      setResult(await api(`/verify/incident/${incident._id}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="integrity" onClick={(e) => e.stopPropagation()}>
      <div className="hint">
        Blockchain: {incident.chainTxHash
          ? <>logged in tx <span className="mono">{incident.chainTxHash.slice(0, 18)}...</span></>
          : 'not logged (chain was offline)'}
      </div>
      <button className="btn-outline btn-small" onClick={check} disabled={busy}>{busy ? 'Checking...' : 'Verify integrity'}</button>
      {error && <p className="error">{error}</p>}
      {result && <CheckList result={result} />}
    </div>
  );
}

function IncidentCard({ incident: i, selected, onSelect }) {
  const tourist = i.touristId || {};
  const [lat, lng] = toLatLng(i.location);

  return (
    <div className={`incident ${selected ? 'selected' : ''}`} style={{ borderLeftColor: STATUS_INFO[i.status].color }} onClick={onSelect}>
      <div className="incident-head">
        <b>{i.type}: {tourist.name || 'Unknown tourist'}</b>
        <span className="badge" style={{ background: STATUS_INFO[i.status].color, color: 'white' }}>{i.status}</span>
      </div>
      <div className="hint">{new Date(i.createdAt).toLocaleString()} ({timeAgo(i.createdAt)})</div>
      {i.message && <div className="incident-msg">"{i.message}"</div>}

      {selected && (
        <>
          <table className="details">
            <tbody>
              <tr><th>Phone</th><td>{tourist.phone || '-'}</td></tr>
              <tr><th>Nationality</th><td>{tourist.nationality || '-'}</td></tr>
              <tr><th>Emergency contact</th><td>{tourist.emergencyContact?.name}, {tourist.emergencyContact?.phone}</td></tr>
              <tr><th>Location</th><td>{lat.toFixed(5)}, {lng.toFixed(5)}</td></tr>
              <tr><th>Assigned to</th><td>{i.assignedTo || '-'}</td></tr>
            </tbody>
          </table>
          <h4>History</h4>
          <ul className="history">
            {i.history.map((h) => (
              <li key={h._id}>
                <b>{h.status}</b> by {h.by?.name || 'unknown'} at {new Date(h.at).toLocaleTimeString()}
                {h.note && `: ${h.note}`}
              </li>
            ))}
          </ul>
          {/* key resets the inputs after each status change */}
          <IncidentActions key={i.status} incident={i} />
          {/* key clears an old integrity result when the incident changes */}
          <IntegrityCheck key={i.updatedAt} incident={i} />
        </>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  const { incidents, error } = useIncidents();
  const [filter, setFilter] = useState('Open');
  const [selectedId, setSelectedId] = useState(null);

  const matches = (i) => filter === 'All' || (filter === 'Open' ? i.status !== 'Resolved' : i.status === filter);
  const shown = incidents.filter(matches);
  const selected = incidents.find((i) => i._id === selectedId);
  const count = (status) => incidents.filter((i) => i.status === status).length;

  return (
    <div className="dashboard">
      <div>
        <MapView>
          {shown.map((i) => (
            <CircleMarker
              key={i._id}
              center={toLatLng(i.location)}
              radius={i._id === selectedId ? 14 : 10}
              pathOptions={{ color: i._id === selectedId ? '#1e293b' : 'white', weight: 3, fillColor: STATUS_INFO[i.status].color, fillOpacity: 1 }}
              eventHandlers={{ click: () => setSelectedId(i._id) }}
            >
              <Tooltip>{i.type}: {i.touristId?.name} ({i.status})</Tooltip>
            </CircleMarker>
          ))}
          {selected && <PanTo position={toLatLng(selected.location)} />}
        </MapView>
        <div className="legend">
          {Object.entries(STATUS_INFO).map(([status, info]) => (
            <span key={status}><span className="dot" style={{ background: info.color }} /> {status} ({count(status)})</span>
          ))}
        </div>
      </div>

      <div className="side">
        <div className="card incidents-panel">
          <h3>Incidents</h3>
          <div className="tabs">
            {FILTERS.map((f) => (
              <button key={f} className={f === filter ? 'tab active' : 'tab'} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          {shown.length === 0 && <p className="hint">No incidents here.</p>}
          {shown.map((i) => (
            <IncidentCard key={i._id} incident={i} selected={i._id === selectedId} onSelect={() => setSelectedId(i._id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
