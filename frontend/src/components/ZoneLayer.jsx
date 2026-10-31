// Draws the geo-fence zones as coloured polygons. Hover shows the name.
import { Polygon, Tooltip } from 'react-leaflet';
import { ZONE_INFO, polygonToLatLngs } from '../utils';

export default function ZoneLayer({ zones }) {
  return zones.map((zone) => (
    <Polygon
      key={zone._id}
      positions={polygonToLatLngs(zone.geometry)}
      pathOptions={{ color: ZONE_INFO[zone.type].color, weight: 2, fillOpacity: 0.15 }}
    >
      <Tooltip sticky>
        <b>{zone.name}</b> ({ZONE_INFO[zone.type].label})
        {zone.description && <><br />{zone.description}</>}
      </Tooltip>
    </Polygon>
  ));
}
