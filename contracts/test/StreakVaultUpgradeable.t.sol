// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {StreakVaultUpgradeable} from "../src/StreakVaultUpgradeable.sol";
import {RewardsPoolUpgradeable} from "../src/RewardsPoolUpgradeable.sol";
import {StreakVaultUpgradeableV2Mock} from "./mocks/UpgradeMocks.sol";
import {MockGD, MockIdentity} from "./mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IRewardsPool} from "../src/interfaces/IRewardsPool.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract StreakVaultUpgradeableTest is Test {
    MockGD gd;
    MockIdentity id;
    RewardsPoolUpgradeable pool;
    StreakVaultUpgradeable vault;
    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address signer = makeAddr("signer");
    address ubi = makeAddr("ubi");
    address a = makeAddr("a");
    address b = makeAddr("b");
    address nobody = makeAddr("nobody");

    uint128 constant MIN = 10e18;
    uint128 constant MAX = 100e18;

    function setUp() public {
        vm.warp(400 days);
        gd = new MockGD();
        id = new MockIdentity();

        RewardsPoolUpgradeable poolImpl = new RewardsPoolUpgradeable();
        bytes memory poolInit = abi.encodeCall(RewardsPoolUpgradeable.initialize, (IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer, 10e18, 30e18, 100e18));
        pool = RewardsPoolUpgradeable(address(new ERC1967Proxy(address(poolImpl), poolInit)));

        StreakVaultUpgradeable vaultImpl = new StreakVaultUpgradeable();
        bytes memory vaultInit =
            abi.encodeCall(StreakVaultUpgradeable.initialize, (IERC20(address(gd)), IIdentity(address(id)), IRewardsPool(address(pool)), ubi, admin, guardian, signer));
        vault = StreakVaultUpgradeable(address(new ERC1967Proxy(address(vaultImpl), vaultInit)));

        address[2] memory us = [a, b];
        for (uint256 i; i < 2; ++i) {
            id.verify(us[i], us[i]);
            gd.mint(us[i], 1_000e18);
            vm.prank(us[i]);
            gd.approve(address(vault), type(uint256).max);
        }
    }

    function _create(uint32 lengthDays) internal returns (uint256 id_, uint64 start) {
        start = uint64(block.timestamp + 1 days);
        vm.prank(admin);
        id_ = vault.createCohort(start, lengthDays, MIN, MAX);
    }

    function _finish(uint256 cid, address who) internal {
        address[] memory us = new address[](1);
        us[0] = who;
        vm.prank(signer);
        vault.markFinished(cid, us);
    }

    // ------------------------------------------------------------ proxy wiring + core behavior sanity

    function test_initializedThroughProxy_defaultsMatchOriginal() public view {
        assertEq(vault.finishersBps(), 7000);
        assertEq(vault.rewardsBps(), 2000);
        assertEq(vault.ubiBps(), 1000);
        assertEq(vault.nextCohortId(), 1);
    }

    function test_cannotInitializeTwice() public {
        vm.expectRevert();
        vault.initialize(IERC20(address(gd)), IIdentity(address(id)), IRewardsPool(address(pool)), ubi, admin, guardian, signer);
    }

    function test_oneStakePerHumanStillEnforced() public {
        (uint256 cid,) = _create(7);
        vm.prank(a);
        vault.stake(cid, 50e18);
        vm.prank(a);
        vm.expectRevert(StreakVaultUpgradeable.AlreadyStaked.selector);
        vault.stake(cid, 10e18);
    }

    function test_unverifiedCannotStake() public {
        (uint256 cid,) = _create(7);
        gd.mint(nobody, 100e18);
        vm.startPrank(nobody);
        gd.approve(address(vault), type(uint256).max);
        vm.expectRevert(StreakVaultUpgradeable.NotVerified.selector);
        vault.stake(cid, 50e18);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ variable cohort length

    function test_createCohort_acceptsSevenFourteenThirtyDays() public {
        (uint256 c7, uint64 s7) = _create(7);
        (uint256 c14, uint64 s14) = _create(14);
        (uint256 c30, uint64 s30) = _create(30);
        (uint64 start7, uint64 end7,,,,,,) = vault.cohorts(c7);
        (uint64 start14, uint64 end14,,,,,,) = vault.cohorts(c14);
        (uint64 start30, uint64 end30,,,,,,) = vault.cohorts(c30);
        assertEq(end7 - start7, 7 days);
        assertEq(end14 - start14, 14 days);
        assertEq(end30 - start30, 30 days);
        assertEq(start7, s7); assertEq(start14, s14); assertEq(start30, s30);
    }

    function test_createCohort_rejectsUnsupportedLength() public {
        vm.prank(admin);
        vm.expectRevert(StreakVaultUpgradeable.UnsupportedLength.selector);
        vault.createCohort(uint64(block.timestamp + 1 days), 10, MIN, MAX);
    }

    // ------------------------------------------------------------ bonus bps admin control

    function test_onlyAdminCanSetBonusBps() public {
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, a, bytes32(0)));
        vault.setBonusBps(14, 200);
    }

    function test_setBonusBps_rejectsUnsupportedLength() public {
        vm.prank(admin);
        vm.expectRevert(StreakVaultUpgradeable.UnsupportedLength.selector);
        vault.setBonusBps(10, 200);
    }

    function test_setBonusBps_capsAt50Percent() public {
        vm.prank(admin);
        vm.expectRevert(StreakVaultUpgradeable.BonusCapExceeded.selector);
        vault.setBonusBps(14, 5001);
    }

    function test_sevenDayCohort_hasNoBonusByDefault() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.warp(start + 7 days);
        _finish(cid, a);
        vm.prank(signer);
        vault.settle(cid);
        (,,,,,,uint256 finisherPool,) = vault.cohorts(cid);
        assertEq(finisherPool, 0); // nobody forfeited, no bonus configured for 7 days
    }

    // ------------------------------------------------------------ funding the bonus reserve

    function test_fundBonusReserve_recordsAmountReceived() public {
        gd.mint(address(this), 100e18);
        gd.approve(address(vault), type(uint256).max);
        vault.fundBonusReserve(100e18);
        assertEq(vault.bonusReserve(), 100e18);
    }

    function test_fundBonusReserve_recordsReceivedAfterFee() public {
        gd.setFee(100); // 1%
        gd.mint(address(this), 100e18);
        gd.approve(address(vault), type(uint256).max);
        vault.fundBonusReserve(100e18);
        assertEq(vault.bonusReserve(), 99e18);
    }

    // ------------------------------------------------------------ settle() pays the length bonus

    function test_settle_paysConfiguredBonusToFinishers() public {
        vm.prank(admin);
        vault.setBonusBps(30, 600); // 6%
        gd.mint(address(this), 1_000e18);
        gd.approve(address(vault), type(uint256).max);
        vault.fundBonusReserve(1_000e18);

        (uint256 cid, uint64 start) = _create(30);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.prank(b); vault.stake(cid, 100e18); // b will not finish -> forfeits
        vm.warp(start + 30 days);
        _finish(cid, a);
        vm.prank(signer);
        vault.settle(cid);

        // forfeit from b: 100e18 * 70% to finisher pool = 70e18; bonus: finishedStake(100e18) * 6% = 6e18
        (,,,,,, uint256 finisherPool,) = vault.cohorts(cid);
        assertEq(finisherPool, 76e18);
        assertEq(vault.bonusReserve(), 1_000e18 - 6e18);

        vm.prank(a);
        vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18 - 100e18 + 100e18 + 76e18); // principal back + full finisherPool (sole finisher)
    }

    function test_settle_revertsIfBonusReserveUnderfunded() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500); // 5%, but reserve is left empty

        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.warp(start + 14 days);
        _finish(cid, a);

        vm.prank(signer);
        vm.expectRevert(StreakVaultUpgradeable.InsufficientBonusReserve.selector);
        vault.settle(cid);
    }

    function test_settle_noBonusOwedWhenNobodyFinishes_doesNotTouchReserve() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500);
        gd.mint(address(this), 100e18);
        gd.approve(address(vault), type(uint256).max);
        vault.fundBonusReserve(100e18);

        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.warp(start + 14 days);
        // nobody marked finished
        vm.prank(signer);
        vault.settle(cid);
        assertEq(vault.bonusReserve(), 100e18); // untouched
    }

    function testFuzz_bonusNeverExceedsReserve(uint16 bps, uint256 stakeAmt) public {
        bps = uint16(bound(bps, 0, vault.MAX_BONUS_BPS()));
        stakeAmt = bound(stakeAmt, MIN, MAX);
        vm.prank(admin);
        vault.setBonusBps(7, bps);

        uint256 reserve = uint256(stakeAmt) * bps / 10_000; // exactly enough, no more
        if (reserve > 0) {
            gd.mint(address(this), reserve);
            gd.approve(address(vault), type(uint256).max);
            vault.fundBonusReserve(reserve);
        }

        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, stakeAmt);
        vm.warp(start + 7 days);
        _finish(cid, a);
        vm.prank(signer);
        vault.settle(cid); // must not revert: reserve exactly covers the bonus owed
        assertEq(vault.bonusReserve(), 0);
    }

    // ------------------------------------------------------------ upgrade mechanics

    function test_adminCanUpgradeAndStateSurvives() public {
        (uint256 cid,) = _create(7);
        vm.prank(a);
        vault.stake(cid, 50e18);

        StreakVaultUpgradeableV2Mock v2 = new StreakVaultUpgradeableV2Mock();
        vm.prank(admin);
        vault.upgradeToAndCall(address(v2), "");

        assertEq(vault.stakeOf(cid, a), 50e18); // storage survives
        assertEq(StreakVaultUpgradeableV2Mock(address(vault)).version(), "v2");
    }

    function test_nonAdminCannotUpgrade() public {
        StreakVaultUpgradeableV2Mock v2 = new StreakVaultUpgradeableV2Mock();
        vm.prank(a);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, a, bytes32(0)));
        vault.upgradeToAndCall(address(v2), "");
    }
}
