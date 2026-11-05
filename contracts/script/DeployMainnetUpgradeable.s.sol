// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DeployUpgradeableBase} from "./DeployUpgradeableBase.s.sol";

/// @notice Celo mainnet deploy of the upgradeable contracts. UNAUDITED: caps are deliberately tiny,
///   keep pause() ready, raise only after review.
///   forge script script/DeployMainnetUpgradeable.s.sol --rpc-url $CELO_RPC_URL --broadcast
/// Required env: DEPLOYER_PRIVATE_KEY, ADMIN (Safe), GUARDIAN (Safe), SIGNER, UBI_ADDRESS.
contract DeployMainnetUpgradeable is DeployUpgradeableBase {
    address constant GD = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A;
    address constant IDENTITY = 0xC361A6E67822a0EDc17D899227dd9FC50BD62F42;

    function _config() internal pure override returns (Config memory) {
        return Config({token: GD, identity: IDENTITY, dailyCap: 2e18, weeklyCap: 6e18, dailyBudget: 50e18});
    }
}
