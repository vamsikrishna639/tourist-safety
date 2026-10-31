// Deploys TouristRegistry to the local Hardhat node and saves its address + ABI to blockchain/deployment.json.
// The backend reads that file, so after every Hardhat restart you only need: npm run chain:deploy
const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners(); // account #0 becomes the contract owner
  const registry = await hre.ethers.deployContract('TouristRegistry');
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const { abi } = await hre.artifacts.readArtifact('TouristRegistry');
  const { chainId } = await hre.ethers.provider.getNetwork();

  const deployment = {
    address,
    chainId: Number(chainId),
    owner: deployer.address,
    deployedAt: new Date().toISOString(),
    abi,
  };
  const file = path.join(__dirname, '..', 'deployment.json');
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  console.log(`TouristRegistry deployed to ${address} (chain ${chainId}, owner ${deployer.address})`);
  console.log(`Saved to ${file}`);
  console.log('Next: npm run seed (fresh demo data) or npm run chain:sync (keep data, re-register it on chain)');
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
