// Rebuilds the blockchain records from MongoDB WITHOUT wiping any data.
// Needed because the Hardhat node keeps its chain in memory: after a restart + redeploy it is empty again.
// Run with:  npm run chain:sync   (after "npm run chain" and "npm run chain:deploy")
//
// Note: this trusts the current MongoDB data. On a real blockchain the chain is never reset, so this script
// would not exist; it only makes the local development chain convenient.
const mongoose = require('mongoose');
const connectDB = require('../db');
const User = require('../models/User');
const Incident = require('../models/Incident');
const chain = require('../services/blockchain');
const { computeIncidentHash } = require('../utils/incidentHash');

async function sync() {
  await connectDB();
  const status = await chain.getChainStatus();
  console.log(`[sync] Contract ${status.address}, block ${status.blockNumber}`);

  // 1. Digital IDs (and revocations)
  let registered = 0;
  let revoked = 0;
  const tourists = await User.find({ role: 'tourist', idHash: { $exists: true } }).lean();
  for (const t of tourists) {
    const onChain = await chain.getIdStatus(t.idHash);
    if (!onChain.registered) {
      const txHash = await chain.registerId(t.idHash);
      await User.updateOne({ _id: t._id }, { idTxHash: txHash });
      registered++;
    }
    if (t.idRevokedAt && !onChain.revoked) {
      await chain.revokeId(t.idHash);
      revoked++;
    }
  }
  console.log(`[sync] Digital IDs: ${registered} registered, ${revoked} revoked, ${tourists.length - registered} already on chain`);

  // 2. Incidents: log the current state of any incident whose hash is not on chain
  let logged = 0;
  const incidents = await Incident.find().lean();
  for (const inc of incidents) {
    const hash = computeIncidentHash(inc);
    if ((await chain.getIncidentLoggedAt(hash)) === 0) {
      const txHash = await chain.logIncidentHash(hash);
      await Incident.updateOne({ _id: inc._id }, { chainHash: hash, chainTxHash: txHash, chainLoggedAt: new Date() });
      logged++;
    }
  }
  console.log(`[sync] Incidents: ${logged} logged, ${incidents.length - logged} already on chain`);
}

sync()
  .catch((err) => {
    console.error('[sync] Failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    chain.closeChain();
    return mongoose.disconnect();
  });
