// Seed script: wipes the demo data and inserts sample zones, stations, an admin and 6 tourists,
// then registers every tourist's Digital ID hash on the blockchain.
// Run with:  npm run seed   (after "npm run chain" and "npm run chain:deploy")
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const connectDB = require('../db');
const User = require('../models/User');
const Zone = require('../models/Zone');
const Station = require('../models/Station');
const Location = require('../models/Location');
const Incident = require('../models/Incident');
const { createSalt, computeIdHash } = require('../utils/digitalId');
const { registerId, closeChain } = require('../services/blockchain');

// Demo city: Hyderabad. Coordinates are approximate and for demo use only.
// Remember: GeoJSON uses [longitude, latitude].

// Builds a closed rectangular polygon from two corners
function rect(minLng, minLat, maxLng, maxLat) {
  return {
    type: 'Polygon',
    coordinates: [[
      [minLng, minLat],
      [maxLng, minLat],
      [maxLng, maxLat],
      [minLng, maxLat],
      [minLng, minLat], // back to the first point to close the ring
    ]],
  };
}

const zones = [
  { name: 'Hussain Sagar & Tank Bund', type: 'green', description: 'Patrolled tourist area', geometry: rect(78.465, 17.415, 78.48, 17.43) },
  { name: 'Birla Mandir & Lumbini Park', type: 'green', description: 'Safe, well-lit public area', geometry: rect(78.466, 17.404, 78.476, 17.412) },
  { name: 'Charminar Market', type: 'yellow', description: 'Very crowded, pickpocket risk', geometry: rect(78.471, 17.3585, 78.479, 17.365) },
  { name: 'Golconda Fort Outer Ruins', type: 'yellow', description: 'Isolated paths, poor lighting after dark', geometry: rect(78.398, 17.38, 78.406, 17.387) },
  { name: 'Musi Riverbed', type: 'red', description: 'Restricted: flood risk', geometry: rect(78.483, 17.369, 78.495, 17.3715) },
  { name: 'Restricted Defence Area', type: 'red', description: 'No entry for civilians', geometry: rect(78.39, 17.39, 78.398, 17.396) },
];

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

const stations = [
  { name: 'Charminar Police Station', type: 'police', phone: '100', address: 'Charminar, Hyderabad', location: point(78.4735, 17.3622) },
  { name: 'Golconda Police Station', type: 'police', phone: '100', address: 'Golconda, Hyderabad', location: point(78.404, 17.389) },
  { name: 'Saifabad Police Station', type: 'police', phone: '100', address: 'Saifabad, Hyderabad', location: point(78.4665, 17.4005) },
  { name: 'Lake Police Station', type: 'police', phone: '100', address: 'Tank Bund, Hyderabad', location: point(78.4745, 17.4185) },
  { name: 'Osmania General Hospital', type: 'hospital', phone: '108', address: 'Afzal Gunj, Hyderabad', location: point(78.4747, 17.3725) },
  { name: 'Gandhi Hospital', type: 'hospital', phone: '108', address: 'Secunderabad', location: point(78.503, 17.425) },
  { name: 'Nampally Area Hospital', type: 'hospital', phone: '108', address: 'Nampally, Hyderabad', location: point(78.466, 17.393) },
];

// Trip dates relative to today, so the demo IDs are always valid
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const tripStart = new Date(now - DAY);
const tripEnd = new Date(now + 7 * DAY);

const ADMIN = { name: 'Control Room Admin', email: 'admin@demo.com', password: 'Admin@123' };
const TOURIST_PASSWORD = 'Tourist@123';
const tourists = [
  { name: 'Aarav Sharma', email: 'tourist1@demo.com', govtId: 'AADHAAR-1111-2222', nationality: 'India', phone: '9000000001', emergencyContact: { name: 'Meera Sharma', phone: '9000000101', relation: 'Mother' } },
  { name: 'Emma Wilson', email: 'tourist2@demo.com', govtId: 'P-GB1234567', nationality: 'United Kingdom', phone: '9000000002', emergencyContact: { name: 'John Wilson', phone: '9000000102', relation: 'Father' } },
  { name: 'Liam Chen', email: 'tourist3@demo.com', govtId: 'P-SG7654321', nationality: 'Singapore', phone: '9000000003', emergencyContact: { name: 'Grace Chen', phone: '9000000103', relation: 'Sister' } },
  { name: 'Priya Reddy', email: 'tourist4@demo.com', govtId: 'AADHAAR-3333-4444', nationality: 'India', phone: '9000000004', emergencyContact: { name: 'Ravi Reddy', phone: '9000000104', relation: 'Husband' } },
  { name: 'Lucas Muller', email: 'tourist5@demo.com', govtId: 'P-DE9988776', nationality: 'Germany', phone: '9000000005', emergencyContact: { name: 'Anna Muller', phone: '9000000105', relation: 'Wife' } },
  // Trip already over: used to demonstrate that verification rejects expired IDs (not moved by the simulator)
  { name: 'Sofia Rossi', email: 'tourist6@demo.com', govtId: 'P-IT5544332', nationality: 'Italy', phone: '9000000006', emergencyContact: { name: 'Marco Rossi', phone: '9000000106', relation: 'Brother' }, tripStart: new Date(now - 10 * DAY), tripEnd: new Date(now - 2 * DAY) },
];

async function seed() {
  await connectDB();

  // 1. Clear old demo data (deleteMany keeps the indexes, unlike dropping the database)
  await Promise.all([User, Zone, Station, Location, Incident].map((Model) => Model.deleteMany({})));
  // Make sure the 2dsphere and unique indexes exist before inserting
  await Promise.all([User, Zone, Station, Location, Incident].map((Model) => Model.syncIndexes()));

  // 2. Zones and stations
  await Zone.insertMany(zones);
  await Station.insertMany(stations);
  console.log(`[seed] ${zones.length} zones, ${stations.length} stations`);

  // 3. Admin
  await User.create({
    name: ADMIN.name,
    email: ADMIN.email,
    role: 'admin',
    passwordHash: await bcrypt.hash(ADMIN.password, config.bcryptRounds),
  });

  // 4. Tourists, each with their own salt and Digital ID hash
  const touristPasswordHash = await bcrypt.hash(TOURIST_PASSWORD, config.bcryptRounds);
  const saved = [];
  for (const t of tourists) {
    // default trip dates unless the sample tourist has its own
    const user = new User({ tripStart, tripEnd, ...t, role: 'tourist', passwordHash: touristPasswordHash });
    user.salt = createSalt();
    user.idHash = computeIdHash(user, user.salt);
    saved.push(await user.save());
  }
  console.log(`[seed] 1 admin, ${tourists.length} tourists`);

  // 5. Register every Digital ID hash on the blockchain (Hardhat starts empty after each restart)
  try {
    for (const user of saved) {
      const txHash = await registerId(user.idHash);
      await User.updateOne({ _id: user._id }, { idTxHash: txHash });
    }
    console.log(`[seed] ${saved.length} Digital IDs registered on the blockchain`);
  } catch (err) {
    console.warn(`\n[seed] WARNING: ${err.message}`);
    console.warn('[seed] The database is seeded, but the Digital IDs are NOT on the blockchain.');
    console.warn('[seed] Start the chain (npm run chain), deploy (npm run chain:deploy), then run: npm run chain:sync\n');
  }

  console.log('\nLogin credentials:');
  console.table([
    { role: 'admin', email: ADMIN.email, password: ADMIN.password },
    ...tourists.map((t) => ({ role: 'tourist', email: t.email, password: TOURIST_PASSWORD })),
  ]);
}

seed()
  .catch((err) => {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    closeChain();
    return mongoose.disconnect();
  });
