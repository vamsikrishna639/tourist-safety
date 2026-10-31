// Admin page: draw new geo-fence zones on the map, change their type, delete them.
import { useState } from 'react';
import { Polygon } from 'react-leaflet';
import MapView from '../components/MapView';
import ZoneLayer from '../components/ZoneLayer';
import DrawControl from '../components/DrawControl';
import { api } from '../api';
import { useZones } from '../useZones';
import { ZONE_INFO, polygonToLatLngs } from '../utils';

export default function ZoneManager() {
  const { zones, reload, error: loadError } = useZones();
  const [draft, setDraft] = useState(null); // the shape just drawn, waiting for a name and type
  const [error, setError] = useState('');

  // Runs an API call, shows any error, and reloads the zone list
  async function run(action) {
    setError('');
    try {
      await action();
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function saveDraft(e) {
    e.preventDefault();
    run(async () => {
      await api('/zones', { method: 'POST', body: draft });
      setDraft(null);
    });
  }

  const changeType = (zone, type) => run(() => api(`/zones/${zone._id}`, { method: 'PUT', body: { type } }));

  const remove = (zone) => {
    if (window.confirm(`Delete zone "${zone.name}"?`)) run(() => api(`/zones/${zone._id}`, { method: 'DELETE' }));
  };

  const updateDraft = (e) => setDraft({ ...draft, [e.target.name]: e.target.value });

  return (
    <div className="dashboard">
      <div>
        <MapView>
          <ZoneLayer zones={zones} />
          {draft && (
            <Polygon positions={polygonToLatLngs(draft.geometry)} pathOptions={{ color: ZONE_INFO[draft.type].color, dashArray: '6' }} />
          )}
          <DrawControl onCreated={(geometry) => setDraft({ geometry, name: '', type: 'yellow', description: '' })} />
        </MapView>
        <p className="hint">Use the polygon or rectangle tool (top right of the map) to draw a new zone.</p>
      </div>

      <div className="side">
        {draft && (
          <div className="card">
            <h3>New zone</h3>
            <form onSubmit={saveDraft}>
              <label>Name<input name="name" value={draft.name} onChange={updateDraft} required autoFocus /></label>
              <label>
                Type
                <select name="type" value={draft.type} onChange={updateDraft}>
                  <option value="red">Red: restricted</option>
                  <option value="yellow">Yellow: caution</option>
                  <option value="green">Green: safe</option>
                </select>
              </label>
              <label>Description<input name="description" value={draft.description} onChange={updateDraft} /></label>
              <div className="row">
                <button>Save zone</button>
                <button type="button" className="btn-secondary" onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          <h3>Zones ({zones.length})</h3>
          {(error || loadError) && <p className="error">{error || loadError}</p>}
          {zones.map((zone) => (
            <div key={zone._id} className="zone-row">
              <span className="dot" style={{ background: ZONE_INFO[zone.type].color }} />
              <span className="zone-name" title={zone.description}>{zone.name}</span>
              <select value={zone.type} onChange={(e) => changeType(zone, e.target.value)}>
                <option value="red">red</option>
                <option value="yellow">yellow</option>
                <option value="green">green</option>
              </select>
              <button className="btn-small btn-danger" onClick={() => remove(zone)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
