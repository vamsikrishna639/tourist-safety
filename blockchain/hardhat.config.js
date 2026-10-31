require('@nomicfoundation/hardhat-toolbox'); // adds hre.ethers (ethers v6)

module.exports = {
  solidity: '0.8.24',
  networks: {
    // The node started by "npm run chain" (hardhat node). Chain id 31337, in memory, resets on restart.
    localhost: { url: 'http://127.0.0.1:8545' },
  },
};
