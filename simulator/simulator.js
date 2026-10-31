// Fake GPS for the demo. Moves the 5 seeded tourists along preset routes and sends their positions
// to the backend exactly like a tourist's phone would: log in, then POST /api/tourists/location repeatedly.
// Run from the project root:  npm run simulate   (backend running + database seeded first)
const ROUTES = require('./routes');

const API = process.env.API_URL || 'http://127.0.0.1:5000/api';
const PASSWORD = 'Tourist@123'; // seeded tourist password
const TICK_MS = 3000; // send one position per tourist every 3 seconds
const STEP_METERS = 40; // distance moved per tick (sped up for the demo; real walking is ~4 m per 3 s)

// Distance in metres between two [lat, lng] points (haversine formula)
function distanceMeters([lat1, lng1], [lat2, lng2]) {
  const R = 6371000; // Earth radius in metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Turns a few waypoints into many small points about STEP_METERS apart (straight-line interpolation)
function buildPath(waypoints, loop) {
  const points = loop ? [...waypoints, waypoints[0]] : waypoints; // a loop walks back to the start
  const path = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const steps = Math.max(1, Math.round(distanceMeters(a, b) / STEP_METERS));
    for (let s = 0; s < steps; s++) {
      const t = s / steps; // 0 -> 1 along this segment
      path.push([+(a[0] + (b[0] - a[0]) * t).toFixed(6), +(a[1] + (b[1] - a[1]) * t).toFixed(6)]);
    }
  }
  if (!loop) path.push(points[points.length - 1]); // one-way routes end exactly on the last waypoint
  return path;
}

// POST JSON to the backend, throw a readable error on failure
async function post(path, body, token) {
  let res;
  try {
    res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`cannot reach ${API} (is the backend running?)`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// Send the current point of one tourist, then move them one step forward
async function step(walker) {
  const [lat, lng] = walker.path[walker.index];
  try {
    await post('/tourists/location', { lat, lng, source: 'simulator' }, walker.token);
  } catch (err) {
    console.error(`[sim] ${walker.name}: ${err.message}`);
    return; // retry the same point next tick
  }
  walker.index = walker.loop
    ? (walker.index + 1) % walker.path.length // wrap around to the start
    : Math.min(walker.index + 1, walker.path.length - 1); // stay on the last point
}

async function main() {
  const walkers = [];
  for (const route of ROUTES) {
    try {
      const { token, user } = await post('/auth/login', { email: route.email, password: PASSWORD });
      const path = buildPath(route.waypoints, route.loop);
      walkers.push({ ...route, token, name: user.name, path, index: 0 });
      console.log(`[sim] ${user.name.padEnd(14)} ${String(path.length).padStart(3)} points  ${route.description}`);
    } catch (err) {
      console.error(`[sim] login failed for ${route.email}: ${err.message}`);
    }
  }

  if (walkers.length === 0) {
    console.error('[sim] Nothing to simulate. Start the backend and run "npm run seed" first.');
    process.exit(1);
  }

  console.log(`[sim] Sending positions every ${TICK_MS / 1000}s. Press Ctrl+C to stop.`);
  const tick = () => walkers.forEach(step);
  tick();
  setInterval(tick, TICK_MS);
}

main();
