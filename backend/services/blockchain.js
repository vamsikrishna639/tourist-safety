// Talks to the TouristRegistry contract on the local Hardhat node using ethers v6.
// Address + ABI come from blockchain/deployment.json (written by the deploy script).
const fs = require('fs');
const { ethers } = require('ethers');
const config = require('../config');

let cached = { mtimeMs: 0, provider: null, deployment: null };

// Error with an HTTP status the central error handler can use
const chainError = (status, message) => Object.assign(new Error(message), { status });

// The contract's require() message. Depending on how Hardhat reports the revert, ethers puts it in
// err.reason or only inside the nested node error text ("reverted with reason string '...'").
function revertReason(err) {
  if (err.reason) return err.reason;
  const text = [err.error?.message, err.info?.error?.message, err.message].filter(Boolean).join(' ');
  const match = text.match(/reverted with reason string '([^']+)'/);
  return match ? match[1] : null;
}

// Turn low-level ethers errors into messages a user (or viva examiner) understands
function friendly(err) {
  if (err.status) return err; // already friendly
  if (err.code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed|timeout/i.test(err.message)) {
    return chainError(503, `Blockchain node not reachable at ${config.chainRpcUrl}. Start it with: npm run chain`);
  }
  if (err.code === 'BAD_DATA') {
    return chainError(503, 'No contract at the saved address (the Hardhat node was probably restarted). Run: npm run chain:deploy, then npm run seed or npm run chain:sync');
  }
  const reason = revertReason(err);
  if (reason) {
    return chainError(400, `Blockchain rejected the request: ${reason}`); // a require() in the contract failed
  }
  return chainError(502, `Blockchain error: ${err.shortMessage || err.message}`);
}

// Loads deployment.json again whenever it changes, so a redeploy needs no backend restart
function load() {
  let stat;
  try {
    stat = fs.statSync(config.deploymentFile);
  } catch {
    throw chainError(503, 'Contract not deployed yet. Run: npm run chain:deploy');
  }
  if (stat.mtimeMs !== cached.mtimeMs) {
    if (cached.provider) cached.provider.destroy();
    const deployment = JSON.parse(fs.readFileSync(config.deploymentFile, 'utf8'));
    const request = new ethers.FetchRequest(config.chainRpcUrl);
    request.timeout = 5000; // fail fast instead of ethers' 5 minute default
    const network = ethers.Network.from(deployment.chainId);
    // staticNetwork: skip ethers' network auto-detection, which retries forever while the node is down
    const provider = new ethers.JsonRpcProvider(request, network, { staticNetwork: network });
    cached = { mtimeMs: stat.mtimeMs, provider, deployment };
  }
  return cached;
}

// Read-only contract (for view functions)
function reader() {
  const { provider, deployment } = load();
  return new ethers.Contract(deployment.address, deployment.abi, provider);
}

// Contract connected to account #0 (the owner) for transactions.
// Hardhat's node holds that account's key, so it signs and picks the nonce for us.
// (A real deployment would use new ethers.Wallet(PRIVATE_KEY, provider) instead.)
async function writer() {
  const { provider, deployment } = load();
  const signer = await provider.getSigner(0);
  return new ethers.Contract(deployment.address, deployment.abi, signer);
}

// Sends a transaction, waits until it is mined, returns its hash
async function send(method, hash) {
  try {
    const contract = await writer();
    const tx = await contract[method](hash);
    const receipt = await tx.wait();
    return receipt.hash;
  } catch (err) {
    throw friendly(err);
  }
}

const registerId = (idHash) => send('registerID', idHash);
const revokeId = (idHash) => send('revokeID', idHash);
const logIncidentHash = (incidentHash) => send('logIncident', incidentHash);

// { registered, revoked, valid } where valid = the contract's verifyID()
async function getIdStatus(idHash) {
  try {
    const c = reader();
    const [registered, revoked, valid] = await Promise.all([c.registered(idHash), c.revoked(idHash), c.verifyID(idHash)]);
    return { registered, revoked, valid };
  } catch (err) {
    throw friendly(err);
  }
}

// Block time (seconds) when this incident hash was logged, or 0 if it never was
async function getIncidentLoggedAt(incidentHash) {
  try {
    return Number(await reader().incidentLoggedAt(incidentHash));
  } catch (err) {
    throw friendly(err);
  }
}

// For the status line on the Verify page and the server start-up log
async function getChainStatus() {
  try {
    const { provider, deployment } = load();
    const [blockNumber, code] = await Promise.all([provider.getBlockNumber(), provider.getCode(deployment.address)]);
    if (code === '0x') throw Object.assign(new Error('no contract'), { code: 'BAD_DATA' });
    return { ok: true, address: deployment.address, chainId: deployment.chainId, blockNumber };
  } catch (err) {
    throw friendly(err);
  }
}

// Lets scripts (seed, sync) exit cleanly
function closeChain() {
  if (cached.provider) cached.provider.destroy();
  cached = { mtimeMs: 0, provider: null, deployment: null };
}

module.exports = { registerId, revokeId, logIncidentHash, getIdStatus, getIncidentLoggedAt, getChainStatus, closeChain };
