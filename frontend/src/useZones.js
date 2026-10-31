// Loads the geo-fence zones and reloads them whenever an admin changes one (socket event "zones:changed")
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useSocketEvent } from './SocketContext';

export function useZones() {
  const [zones, setZones] = useState([]);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    api('/zones')
      .then((data) => {
        setZones(data.zones);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(reload, [reload]);
  useSocketEvent('zones:changed', reload);

  return { zones, reload, error };
}
