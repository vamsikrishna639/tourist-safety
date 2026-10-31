// Base map used by every page: OpenStreetMap tiles (free, no API key). Markers are passed in as children.
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // without this the tiles render scrambled

export const HYDERABAD = [17.392, 78.455]; // centre of the demo area [lat, lng]

export default function MapView({ center = HYDERABAD, zoom = 13, height = 520, children }) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height, width: '100%', borderRadius: 8 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainer>
  );
}
