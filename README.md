# Smart Tourist Safety Monitoring & Incident Response System

An MCA mini project that helps a city control room keep tourists safe. Tourists share their live location from the browser. The system checks every position against safety zones drawn on a map and raises instant alerts when someone enters a caution or restricted area. A one-tap **SOS** button creates an incident that the control room follows from *Reported* to *Assigned* to *Resolved*.

Tourist identities and incident records are fingerprinted (SHA-256) and logged on a local **Ethereum (Hardhat) blockchain**. Admins can therefore verify a tourist's Digital ID with a QR code and prove that an incident record hasn't been tampered with.

## Features

**For tourists**
- Register with ID details, trip dates and an emergency contact
- Live location sharing from the browser (GPS)
- Map of safe, caution and restricted zones, plus nearby police stations and hospitals
- In-app warnings when entering a caution or restricted zone
- **SOS button**: sends your location to the control room. Repeat presses within 30 seconds are ignored.
- Blockchain-backed **Digital ID card** with a QR code

**For the control room (admin)**
- Live dashboard showing every tourist on a map, with real-time alerts over Socket.IO
- **Zone Manager**: draw, edit and delete green, yellow and red geo-fenced zones on the map
- **Incidents**: track SOS incidents through *Reported → Assigned → Resolved* with a full history
- **Verify**: scan a tourist's QR code to check their Digital ID on chain, revoke IDs, and check incident integrity against the blockchain

**Resilience:** the API keeps working if the blockchain node is down. An SOS is never delayed by the chain; the incident is simply marked as not yet logged.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, Vite, React Router, Leaflet / React-Leaflet, Leaflet.draw, html5-qrcode, Socket.IO client |
| Backend | Node.js 22+, Express 5, MongoDB + Mongoose, Socket.IO, JWT auth, bcrypt, Turf.js (geo-fencing), QRCode |
| Blockchain | Solidity smart contract (`TouristRegistry`), Hardhat, ethers.js v6 |
| Simulator | Node script that moves demo tourists along preset routes in Hyderabad |

## Project Structure

```
tourist-safety/
├── backend/            Express REST API + Socket.IO server
│   ├── models/         Mongoose schemas (User, Zone, Location, Incident, Station)
│   ├── routes/         auth, tourists, zones, incidents, verify
│   ├── services/       tracking pipeline, geo-fencing, alerts, blockchain client
│   ├── utils/          Digital ID + incident hashing, validation
│   └── seed/           demo data seeding and blockchain re-sync
├── frontend/           React app (tourist + admin pages)
├── blockchain/         Hardhat project with the TouristRegistry contract
└── simulator/          fake GPS feed for demos
```

## Getting Started

### Prerequisites
- **Node.js 22** or newer
- **MongoDB** running locally (default `mongodb://127.0.0.1:27017`)

### 1. Install dependencies
```bash
npm run install-all
```

### 2. Configure the backend
```bash
cp backend/.env.example backend/.env
```
Then set `JWT_SECRET` in `backend/.env` to a long random string.

### 3. Start the blockchain (optional, but needed for the Digital ID and integrity features)
In a separate terminal:
```bash
npm run chain          # starts a local Hardhat node on port 8545 (keep it running)
npm run chain:deploy   # deploys TouristRegistry
```

### 4. Seed demo data
```bash
npm run seed
```
This creates the Hyderabad safety zones, police stations, hospitals, an admin and demo tourists.

### 5. Run the app
```bash
npm run dev
```
- Frontend: http://localhost:5173
- API: http://localhost:5000/api (health check: `/api/health`)

### 6. Simulate moving tourists (optional)
In another terminal:
```bash
npm run simulate
```

> The Hardhat node keeps its chain in memory. After restarting it, run `npm run chain:deploy` and then `npm run chain:sync` to rebuild the on-chain records from MongoDB.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.com` | `Admin@123` |
| Tourist | `tourist1@demo.com` to `tourist6@demo.com` | `Tourist@123` |

These are demo credentials created by the seed script. Don't use them in a real deployment.

## API Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register a tourist |
| POST | `/api/auth/login` | Public | Log in and receive a JWT |
| GET | `/api/auth/me` | Logged in | Current user |
| POST | `/api/tourists/location` | Tourist | Send a GPS position |
| GET | `/api/tourists` | Admin | List tourists with their last location |
| GET | `/api/tourists/alerts` | Admin | Recent alerts |
| GET / POST / PUT / DELETE | `/api/zones` | Read: all, write: admin | Manage geo-fenced zones |
| POST | `/api/incidents/sos` | Tourist | Raise an SOS |
| GET | `/api/incidents` | Logged in | List incidents |
| PATCH | `/api/incidents/:id/status` | Admin | Move an incident to its next status |
| GET | `/api/verify/my-id` | Tourist | Your Digital ID and QR code |
| GET | `/api/verify/id/:idHash` | Admin | Verify a Digital ID on chain |
| POST | `/api/verify/id/:idHash/revoke` | Admin | Revoke a Digital ID |
| GET | `/api/verify/incident/:id` | Admin | Check an incident's integrity on chain |
| GET | `/api/verify/chain` | Admin | Blockchain status |

## How It Works

1. **Tracking:** each GPS point is matched to a zone with Turf.js. When zones overlap, the most dangerous one wins. The point is saved, and the update is pushed live to the dashboards.
2. **Alerts:** an alert fires only when a tourist *moves into* a different yellow or red zone, not on every update.
3. **Digital ID:** a salted SHA-256 hash of the tourist's details is registered on chain. Raw personal data never leaves MongoDB.
4. **Incident integrity:** after every status change, the incident's hash is logged on chain. Verification recomputes the hash from MongoDB and checks it against the blockchain.
