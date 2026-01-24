// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgentWalletManagerV2.sol";

contract DeployAgentWalletManager is Script {
    function run() external {
        vm.startBroadcast();

        AgentWalletManagerV2 manager = new AgentWalletManagerV2();

        console.log("AgentWalletManagerV2 deployed at:", address(manager));

        vm.stopBroadcast();
    }
}
