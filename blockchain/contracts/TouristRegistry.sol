// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Stores only SHA-256 hashes: salted Digital ID hashes and incident hashes. No personal data ever goes on chain.
contract TouristRegistry {
    address public immutable owner; // the backend's account; only it can write

    mapping(bytes32 => bool) public registered;
    mapping(bytes32 => bool) public revoked;
    mapping(bytes32 => uint256) public incidentLoggedAt; // incident hash -> block time (0 = never logged)

    event IDRegistered(bytes32 indexed idHash, uint256 timestamp);
    event IDRevoked(bytes32 indexed idHash, uint256 timestamp);
    event IncidentLogged(bytes32 indexed incidentHash, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerID(bytes32 idHash) external onlyOwner {
        require(!registered[idHash], "Already registered");
        registered[idHash] = true;
        emit IDRegistered(idHash, block.timestamp);
    }

    function verifyID(bytes32 idHash) external view returns (bool) {
        return registered[idHash] && !revoked[idHash];
    }

    function revokeID(bytes32 idHash) external onlyOwner {
        require(registered[idHash], "Unknown ID");
        require(!revoked[idHash], "Already revoked");
        revoked[idHash] = true;
        emit IDRevoked(idHash, block.timestamp);
    }

    function logIncident(bytes32 incidentHash) external onlyOwner {
        require(incidentLoggedAt[incidentHash] == 0, "Already logged");
        incidentLoggedAt[incidentHash] = block.timestamp;
        emit IncidentLogged(incidentHash, block.timestamp);
    }
}
