// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/AgenticCommerce.sol";

contract DeployAgenticCommerce is Script {
    function run() external {
        address usdc = 0x3600000000000000000000000000000000000000;

        vm.startBroadcast();

        AgenticCommerce commerce = new AgenticCommerce(usdc);

        vm.stopBroadcast();

        console2.log("AgenticCommerce deployed at:", address(commerce));
    }
}