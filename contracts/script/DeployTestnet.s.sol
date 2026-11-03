// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeployBase} from "./DeployBase.s.sol";

/// @notice Celo testnet deploy with the DEV G$ token. Tiny caps.
///   forge script script/DeployTestnet.s.sol --rpc-url $CELO_TESTNET_RPC_URL --broadcast
/// Required env: DEPLOYER_PRIVATE_KEY, ADMIN, GUARDIAN, SIGNER, UBI_ADDRESS, DEV_IDENTITY (GoodDollar dev Identity contract).
/// Optional: DEV_GD_TOKEN (defaults to the dev G$ below).
contract DeployTestnet is DeployBase {
    address constant DEV_GD = 0xFa51eFDc0910CCdA91732e6806912Fa12e2FD475;

    function _config() internal view override returns (Config memory) {
        return Config({
            token: vm.envOr("DEV_GD_TOKEN", DEV_GD),
            identity: vm.envAddress("DEV_IDENTITY"),
            dailyCap: 5e18,
            weeklyCap: 15e18,
            dailyBudget: 100e18,
            minStake: 1e18,
            maxStake: 10e18
        });
    }
}
