// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IRewardsPool} from "../src/interfaces/IRewardsPool.sol";
import {RewardsPoolUpgradeable} from "../src/RewardsPoolUpgradeable.sol";
import {StreakVaultUpgradeable} from "../src/StreakVaultUpgradeable.sol";

/// @dev Shared deploy logic for the upgradeable contracts. Reads DEPLOYER_PRIVATE_KEY, ADMIN, GUARDIAN,
///      SIGNER, UBI_ADDRESS from the environment, same as the original DeployBase. Unlike DeployBase,
///      the deployer never holds DEFAULT_ADMIN_ROLE at any point - each initialize() grants it straight
///      to ADMIN, so there is no transient admin-holding step and no later handoff transaction needed.
///      Admin and guardian should be a multisig (Safe) on mainnet.
abstract contract DeployUpgradeableBase is Script {
    struct Config {
        address token;
        address identity;
        uint256 dailyCap;
        uint256 weeklyCap;
        uint256 dailyBudget;
    }

    function _config() internal view virtual returns (Config memory);

    function run() external {
        Config memory cfg = _config();
        address admin = vm.envAddress("ADMIN");
        address guardian = vm.envAddress("GUARDIAN");
        address signer = vm.envAddress("SIGNER");
        address ubi = vm.envAddress("UBI_ADDRESS");
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        RewardsPoolUpgradeable poolImpl = new RewardsPoolUpgradeable();
        bytes memory poolInit = abi.encodeCall(
            RewardsPoolUpgradeable.initialize,
            (IERC20(cfg.token), IIdentity(cfg.identity), admin, guardian, signer, cfg.dailyCap, cfg.weeklyCap, cfg.dailyBudget)
        );
        ERC1967Proxy poolProxy = new ERC1967Proxy(address(poolImpl), poolInit);

        StreakVaultUpgradeable vaultImpl = new StreakVaultUpgradeable();
        bytes memory vaultInit = abi.encodeCall(
            StreakVaultUpgradeable.initialize,
            (IERC20(cfg.token), IIdentity(cfg.identity), IRewardsPool(address(poolProxy)), ubi, admin, guardian, signer)
        );
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), vaultInit);

        vm.stopBroadcast();

        console.log("RewardsPool implementation (do not use directly):", address(poolImpl));
        console.log("RewardsPool proxy (use this address everywhere):   ", address(poolProxy));
        console.log("StreakVault implementation (do not use directly): ", address(vaultImpl));
        console.log("StreakVault proxy (use this address everywhere):  ", address(vaultProxy));
        console.log("Next: fund the pool (approve + deposit), then admin calls createCohort(start, lengthDays, min, max).");
    }
}
