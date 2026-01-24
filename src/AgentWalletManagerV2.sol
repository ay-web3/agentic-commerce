// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentWallet.sol";

interface IAgentWallet {
    function updateDailyLimit(uint256 newLimit) external;

    function withdrawETH(address to, uint256 amount) external;

    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 amountUSDC
    ) external;
}

contract AgentWalletManagerV2 {
    event AgentCreated(address indexed user, address agentWallet);
    event LimitUpdated(address indexed agentWallet, uint256 newLimit);

    mapping(address => address) public userToAgent;
    mapping(address => address) public agentToUser;

    /* ============================
        CREATE AGENT
    ============================ */

    function createAgentWallet(uint256 dailyLimit) external returns (address) {
        require(userToAgent[msg.sender] == address(0), "Agent already exists");

        AgentWallet wallet = new AgentWallet(
            msg.sender,
            address(this),
            dailyLimit
        );

        address agentAddress = address(wallet);

        userToAgent[msg.sender] = agentAddress;
        agentToUser[agentAddress] = msg.sender;

        emit AgentCreated(msg.sender, agentAddress);

        return agentAddress;
    }

    /* ============================
        USER CONTROLS
    ============================ */

    function setDailyLimit(uint256 newLimit) external {
        address agent = userToAgent[msg.sender];
        require(agent != address(0), "No agent");

        IAgentWallet(agent).updateDailyLimit(newLimit);

        emit LimitUpdated(agent, newLimit);
    }

    function withdraw(uint256 amount) external {
        address agent = userToAgent[msg.sender];
        require(agent != address(0), "No agent");

        IAgentWallet(agent).withdrawETH(msg.sender, amount);
    }

    /* ============================
        AI EXECUTION (CRITICAL)
    ============================ */

    function executeFromAgent(
        address agentWallet,
        address target,
        uint256 value,
        bytes calldata data,
        uint256 amountUSDC
    ) external {
        require(agentToUser[agentWallet] != address(0), "Invalid agent wallet");

        IAgentWallet(agentWallet).execute(
            target,
            value,
            data,
            amountUSDC
        );
    }

    /* ============================
        VIEWS
    ============================ */

    function getMyAgent() external view returns (address) {
        return userToAgent[msg.sender];
    }
}
