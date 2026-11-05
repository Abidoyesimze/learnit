// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {StreakVaultUpgradeable} from "../../src/StreakVaultUpgradeable.sol";
import {RewardsPoolUpgradeable} from "../../src/RewardsPoolUpgradeable.sol";

/// @dev Stand-in "next version" used only to prove upgradeToAndCall actually swaps logic and keeps storage.
contract StreakVaultUpgradeableV2Mock is StreakVaultUpgradeable {
    function version() external pure returns (string memory) { return "v2"; }
}

contract RewardsPoolUpgradeableV2Mock is RewardsPoolUpgradeable {
    function version() external pure returns (string memory) { return "v2"; }
}
