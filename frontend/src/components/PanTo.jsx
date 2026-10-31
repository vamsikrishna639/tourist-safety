// Moves the map to a [lat, lng] position whenever that position changes
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function PanTo({ position }) {
  const map = useMap();
  const [lat, lng] = position || [];

  // Depend on the numbers, not the array, so a re-render with the same position does not move the map
  useEffect(() => {
    if (lat !== undefined) map.panTo([lat, lng]);
  }, [lat, lng, map]);

  return null;
}
