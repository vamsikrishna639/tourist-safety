// Loads incidents (admin: all, tourist: own) and keeps them live with the "incident" socket event
import { useEffect, useState } from 'react';
import { api } from './api';
import { useSocketEvent } from './SocketContext';

// Insert or replace incidents by id, keeping whichever copy is newer; newest incident first
function merge(current, incoming) {
  const byId = new Map(current.map((i) => [i._id, i]));
  for (const inc of incoming) {
    const old = byId.get(inc._id);
    if (!old || new Date(inc.updatedAt) >= new Date(old.updatedAt)) byId.set(inc._id, inc);
  }
  return [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function useIncidents() {
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/incidents')
      .then((data) => setIncidents((prev) => merge(prev, data.incidents)))
      .catch((err) => setError(err.message));
  }, []);

  useSocketEvent('incident', (incident) => setIncidents((prev) => merge(prev, [incident])));

  return { incidents, error };
}
