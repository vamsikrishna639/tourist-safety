// Adds the leaflet-draw toolbar (polygon + rectangle) to the map.
// When the admin finishes a shape, onCreated(geometry) receives it as a GeoJSON Polygon.
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw'; // plugin: adds L.Control.Draw to the Leaflet object imported above
import 'leaflet-draw/dist/leaflet.draw.css';

export default function DrawControl({ onCreated }) {
  const map = useMap(); // the Leaflet map created by <MapContainer>
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;

  useEffect(() => {
    const control = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: { allowIntersection: false, showArea: false }, // block self-crossing shapes
        rectangle: { showArea: false }, // showArea:true crashes leaflet-draw 1.0.4 ("type is not defined")
        polyline: false,
        circle: false, // circles are not GeoJSON polygons
        circlemarker: false,
        marker: false,
      },
    });
    map.addControl(control);

    // toGeoJSON() converts Leaflet's [lat, lng] shape into GeoJSON [lng, lat], the format the backend stores
    const handleCreated = (e) => onCreatedRef.current(e.layer.toGeoJSON().geometry);
    map.on(L.Draw.Event.CREATED, handleCreated);

    return () => {
      map.off(L.Draw.Event.CREATED, handleCreated);
      map.removeControl(control);
    };
  }, [map]);

  return null; // draws nothing itself; the toolbar is a Leaflet control
}
