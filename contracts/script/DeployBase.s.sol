// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IRewardsPool} from "../src/interfaces/IRewardsPool.sol";
import {RewardsPool} from "../src/RewardsPool.sol";
import {StreakVault} from "../src/StreakVault.sol";

/// @dev Shared deploy logic. Reads DEPLOYER_PRIVATE_KEY, ADMIN, GUARDIAN, SIGNER, UBI_ADDRESS from the environment.
///      Admin and guardian should be a multisig (Safe) on mainnet.
abstract contract DeployBase is Script {
    struct Config {
        address token;
        address identity;
        uint256 dailyCap;
        uint256 weeklyCap;
        uint256 dailyBudget;
        uint128 minStake;
        uint128 maxStake;
    }

    function _config() internal view virtual returns (Config memory);

    function run() external {
        Config memory cfg = _config();
        address admin = vm.envAddress("ADMIN");
        address guardian = vm.envAddress("GUARDIAN");
        address signer = vm.envAddress("SIGNER");
        address ubi = vm.envAddress("UBI_ADDRESS");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        RewardsPool pool = new RewardsPool(IERC20(cfg.token), IIdentity(cfg.identity), msg.sender, guardian, signer);
        pool.setCaps(cfg.dailyCap, cfg.weeklyCap);
        pool.setDailyBudget(cfg.dailyBudget);
        StreakVault vault = new StreakVault(IERC20(cfg.token), IIdentity(cfg.identity), IRewardsPool(address(pool)), ubi, msg.sender, guardian, signer);
        // hand admin over to ADMIN (a multisig on mainnet)
        if (admin != msg.sender) {
            pool.grantRole(pool.DEFAULT_ADMIN_ROLE(), admin);
            pool.renounceRole(pool.DEFAULT_ADMIN_ROLE(), msg.sender);
            vault.grantRole(vault.DEFAULT_ADMIN_ROLE(), admin);
            vault.renounceRole(vault.DEFAULT_ADMIN_ROLE(), msg.sender);
        }
        vm.stopBroadcast();

        console.log("RewardsPool:", address(pool));
        console.log("StreakVault:", address(vault));
        console.log("Next: fund the pool (approve + deposit), then admin calls createCohort(start, min, max).");
    }
}
