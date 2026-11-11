// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {StreakVaultUpgradeable} from "../src/StreakVaultUpgradeable.sol";
import {RewardsPoolUpgradeable} from "../src/RewardsPoolUpgradeable.sol";
import {StreakVaultUpgradeableV2Mock} from "./mocks/UpgradeMocks.sol";
import {MockGD, MockIdentity, RejectingPool} from "./mocks/Mocks.sol";
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

    function _fundReserve(uint256 amount) internal {
        gd.mint(address(this), amount);
        gd.approve(address(vault), type(uint256).max);
        vault.fundBonusReserve(amount);
    }

    /// @dev Signer confirms the results as marked so far, then a stranger settles.
    function _finalizeAndSettle(uint256 cid) internal {
        (,,,,, uint256 finishedStake,,) = vault.cohorts(cid);
        vm.prank(signer);
        vault.finalizeResults(cid, finishedStake);
        vm.prank(nobody);
        vault.settle(cid);
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
        _finalizeAndSettle(cid);
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
        _fundReserve(1_000e18);

        (uint256 cid, uint64 start) = _create(30);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.prank(b); vault.stake(cid, 100e18); // b will not finish -> forfeits
        vm.warp(start + 30 days);
        assertEq(vault.bonusReserve(), 1_000e18 - 12e18); // 6% of both stakes set aside while the cohort runs
        _finish(cid, a);
        _finalizeAndSettle(cid);

        // forfeit from b: 100e18 * 70% to finisher pool = 70e18; bonus: finishedStake(100e18) * 6% = 6e18
        (,,,,,, uint256 finisherPool,) = vault.cohorts(cid);
        assertEq(finisherPool, 76e18);
        assertEq(vault.bonusReserve(), 1_000e18 - 6e18); // b's unearned 6e18 went back to the reserve

        vm.prank(a);
        vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18 - 100e18 + 100e18 + 76e18); // principal back + full finisherPool (sole finisher)
    }

    function test_stake_revertsIfBonusReserveCannotBackTheBonus() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500); // 5%, but the reserve is left empty
        (uint256 cid,) = _create(14);
        vm.prank(a);
        vm.expectRevert(StreakVaultUpgradeable.InsufficientBonusReserve.selector);
        vault.stake(cid, 100e18); // refused up front: nothing is deposited against an unfunded promise
        assertEq(gd.balanceOf(a), 1_000e18);
    }

    function test_settle_noBonusOwedWhenNobodyFinishes_reserveIsMadeWhole() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500);
        _fundReserve(100e18);

        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);
        assertEq(vault.bonusReserve(), 95e18);
        vm.warp(start + 14 days);
        _finalizeAndSettle(cid); // signer confirms that nobody finished
        assertEq(vault.bonusReserve(), 100e18);
    }

    function testFuzz_bonusAlwaysCoveredByWhatStakeSetAside(uint16 bps, uint256 stakeA, uint256 stakeB, bool bFinishes) public {
        bps = uint16(bound(bps, 0, vault.MAX_BONUS_BPS()));
        stakeA = bound(stakeA, MIN, MAX);
        stakeB = bound(stakeB, MIN, MAX);
        vm.prank(admin);
        vault.setBonusBps(7, bps);
        uint256 reserve = (stakeA * bps + 9_999) / 10_000 + (stakeB * bps + 9_999) / 10_000; // exactly enough, no more
        if (reserve > 0) _fundReserve(reserve);

        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, stakeA);
        vm.prank(b); vault.stake(cid, stakeB);
        assertEq(vault.bonusReserve(), 0);
        vm.warp(start + 7 days);
        _finish(cid, a);
        if (bFinishes) _finish(cid, b);
        _finalizeAndSettle(cid); // must not revert

        uint256 paid = (bFinishes ? stakeA + stakeB : stakeA) * bps / 10_000;
        assertEq(vault.bonusReserve(), reserve - paid);
        vm.prank(a); vault.withdraw(cid);
        if (bFinishes) { vm.prank(b); vault.withdraw(cid); }
        // everything still in the vault is accounted for: the reserve plus the forfeit shares awaiting distribute()
        assertGe(gd.balanceOf(address(vault)), vault.bonusReserve() + vault.pendingRewards() + vault.pendingUbi());
        assertLe(gd.balanceOf(address(vault)) - vault.bonusReserve() - vault.pendingRewards() - vault.pendingUbi(), 1); // pro-rata rounding dust
    }

    // ------------------------------------------------------------ L-02: settlement needs confirmed results

    function test_nobodyCanSettleBeforeResultsAreFinal() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.prank(b); vault.stake(cid, 50e18);
        vm.warp(start + 7 days + 5 days); // well past the old one-day public settle delay
        _finish(cid, a); // first batch landed, the one with b never did

        vm.prank(nobody);
        vm.expectRevert(StreakVaultUpgradeable.ResultsNotFinal.selector);
        vault.settle(cid);
        vm.prank(signer);
        vm.expectRevert(StreakVaultUpgradeable.ResultsNotFinal.selector);
        vault.settle(cid);

        _finish(cid, b); // the missing result can still be added
        _finalizeAndSettle(cid);
        vm.prank(b); vault.withdraw(cid);
        assertEq(gd.balanceOf(b), 1_000e18);
    }

    function test_finalizeResults_rejectsIncompleteMarking() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.prank(b); vault.stake(cid, 30e18);
        vm.warp(start + 7 days);
        _finish(cid, a);

        vm.startPrank(signer);
        vm.expectRevert(StreakVaultUpgradeable.ResultsMismatch.selector);
        vault.finalizeResults(cid, 80e18); // backend worked out two finishers, only one is marked
        vm.stopPrank();
        assertFalse(vault.resultsFinal(cid));

        _finish(cid, b);
        vm.prank(signer);
        vault.finalizeResults(cid, 80e18);
        assertTrue(vault.resultsFinal(cid));
    }

    function test_finalizeResults_onlySignerAndOnlyAfterEnd() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.prank(signer);
        vm.expectRevert(StreakVaultUpgradeable.NotEnded.selector);
        vault.finalizeResults(cid, 0);
        vm.warp(start + 7 days);
        bytes32 signerRole = vault.SIGNER_ROLE();
        vm.prank(nobody);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, nobody, signerRole));
        vault.finalizeResults(cid, 0);
    }

    function test_cannotMarkAfterResultsAreFinal() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.warp(start + 7 days);
        vm.prank(signer);
        vault.finalizeResults(cid, 0);
        address[] memory us = new address[](1);
        us[0] = a;
        vm.prank(signer);
        vm.expectRevert(StreakVaultUpgradeable.ResultsAlreadyFinal.selector);
        vault.markFinished(cid, us);
    }

    function test_voidCohort_refundsEveryoneWhenResultsNeverArrive() public {
        vm.prank(admin);
        vault.setBonusBps(7, 500);
        _fundReserve(100e18);
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.prank(b); vault.stake(cid, 30e18);
        vm.warp(start + 7 days);
        _finish(cid, a); // partial results, then the backend goes dark

        vm.warp(start + 7 days + 7 days - 1);
        vm.prank(nobody);
        vm.expectRevert(StreakVaultUpgradeable.CannotVoidYet.selector);
        vault.voidCohort(cid);

        vm.warp(start + 7 days + 7 days);
        vm.prank(nobody);
        vault.voidCohort(cid);
        assertEq(vault.bonusReserve(), 100e18); // set-aside bonus returned
        assertEq(vault.payoutOf(cid, a), 50e18);
        assertEq(vault.payoutOf(cid, b), 30e18);

        vm.prank(a); vault.withdraw(cid);
        vm.prank(b); vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18);
        assertEq(gd.balanceOf(b), 1_000e18); // unmarked, and still made whole
        assertEq(gd.balanceOf(address(vault)), 100e18);

        vm.prank(b);
        vm.expectRevert(StreakVaultUpgradeable.AlreadyWithdrawn.selector);
        vault.withdraw(cid);
        vm.prank(nobody);
        vm.expectRevert(StreakVaultUpgradeable.NotStaked.selector);
        vault.withdraw(cid);

        // a voided cohort cannot be revived
        vm.startPrank(signer);
        vm.expectRevert(StreakVaultUpgradeable.IsVoided.selector);
        vault.finalizeResults(cid, 50e18);
        vm.stopPrank();
        vm.prank(nobody);
        vm.expectRevert(StreakVaultUpgradeable.ResultsNotFinal.selector);
        vault.settle(cid);
    }

    function test_voidCohort_notPossibleOnceResultsAreFinalOrSettled() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 50e18);
        vm.warp(start + 7 days);
        _finish(cid, a);
        vm.prank(signer);
        vault.finalizeResults(cid, 50e18);
        vm.warp(start + 30 days);
        vm.expectRevert(StreakVaultUpgradeable.ResultsAlreadyFinal.selector);
        vault.voidCohort(cid);
        vault.settle(cid);
        vm.expectRevert(StreakVaultUpgradeable.AlreadySettled.selector);
        vault.voidCohort(cid);
    }

    // ------------------------------------------------------------ terms are locked when the cohort is created

    function test_raisingBonusAfterStakesCannotBlockSettlement() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500); // 5% promised
        _fundReserve(5e18); // exactly enough for one 100e18 stake
        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);

        vm.prank(admin);
        vault.setBonusBps(14, 5000); // fat-fingered to 50% with an empty reserve

        vm.warp(start + 14 days);
        _finish(cid, a);
        _finalizeAndSettle(cid); // used to revert with InsufficientBonusReserve
        vm.prank(a); vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18 + 5e18); // the 5% that was promised when a staked

        (, , , uint16 bonusBps,) = vault.termsOf(cid);
        assertEq(bonusBps, 500);
    }

    function test_loweringBonusAfterStakesDoesNotCutThePromise() public {
        vm.prank(admin);
        vault.setBonusBps(14, 500);
        _fundReserve(5e18);
        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.prank(admin);
        vault.setBonusBps(14, 0);
        vm.warp(start + 14 days);
        _finish(cid, a);
        _finalizeAndSettle(cid);
        assertEq(vault.payoutOf(cid, a), 105e18);
    }

    function test_changingSplitAfterStakesDoesNotChangeThisCohort() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.prank(b); vault.stake(cid, 100e18);
        vm.prank(admin);
        vault.setSplit(0, 0, 10_000); // would send every forfeit to the UBI address

        vm.warp(start + 7 days);
        _finish(cid, a);
        _finalizeAndSettle(cid);
        assertEq(vault.payoutOf(cid, a), 170e18); // still 70% of b's forfeit
        assertEq(vault.pendingRewards(), 20e18);
        assertEq(vault.pendingUbi(), 10e18);

        (uint256 next, uint64 start2) = _create(7); // the new split applies from the next cohort on
        vm.prank(a); vault.stake(next, 100e18);
        vm.prank(b); vault.stake(next, 100e18);
        vm.warp(start2 + 7 days);
        _finish(next, a);
        _finalizeAndSettle(next);
        assertEq(vault.payoutOf(next, a), 100e18);
        assertEq(vault.pendingUbi(), 110e18);
    }

    // ------------------------------------------------------------ destinations cannot block finishers

    function test_rejectingDestinationsCannotBlockSettleOrWithdraw() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.prank(b); vault.stake(cid, 100e18);

        RejectingPool bad = new RejectingPool();
        vm.startPrank(admin);
        vault.setRewardsPool(IRewardsPool(address(bad))); // every deposit reverts
        vault.setUbiAddress(address(gd)); // the mock token refuses transfers to itself
        vm.stopPrank();
        gd.setBlocked(address(gd), true);

        vm.warp(start + 7 days);
        _finish(cid, a);
        _finalizeAndSettle(cid);
        vm.prank(a); vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18 + 70e18);

        vm.expectRevert();
        vault.distribute(); // only the protocol's own share waits
        assertEq(vault.pendingRewards(), 20e18);
        assertEq(vault.pendingUbi(), 10e18);

        vm.startPrank(admin); // admin repairs the destinations, nothing was lost
        vault.setRewardsPool(IRewardsPool(address(pool)));
        vault.setUbiAddress(ubi);
        vm.stopPrank();
        vm.prank(nobody);
        vault.distribute();
        assertEq(gd.balanceOf(address(pool)), 20e18);
        assertEq(gd.balanceOf(ubi), 10e18);
        assertEq(vault.pendingRewards(), 0);
        assertEq(vault.pendingUbi(), 0);
        assertEq(gd.balanceOf(address(vault)), 0);
    }

    function test_distribute_sendsRewardsShareToUbiWhenNoPoolIsSet() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.warp(start + 7 days);
        _finalizeAndSettle(cid); // nobody finished: 20% rewards, 80% UBI
        vm.prank(admin);
        vault.setRewardsPool(IRewardsPool(address(0)));
        vault.distribute();
        assertEq(gd.balanceOf(ubi), 100e18);
        assertEq(gd.balanceOf(address(vault)), 0);
    }

    // ------------------------------------------------------------ cohorts that were live before this upgrade

    /// @dev Rebuilds the state of a cohort from before the upgrade (no locked terms, nothing set aside)
    ///      by clearing its termsOf entry after staking.
    function _eraseTerms(uint256 cid) internal {
        bytes32 slot = keccak256(abi.encode(cid, uint256(12))); // termsOf is at slot 12
        vm.store(address(vault), slot, bytes32(0));
        vm.store(address(vault), bytes32(uint256(slot) + 1), bytes32(0));
        (bool locked,,,,) = vault.termsOf(cid);
        assertFalse(locked);
    }

    function test_preUpgradeCohort_settlesEvenIfReserveCannotCoverBonus() public {
        (uint256 cid, uint64 start) = _create(14);
        vm.prank(a); vault.stake(cid, 100e18);
        _eraseTerms(cid);
        vm.prank(admin);
        vault.setBonusBps(14, 500);
        _fundReserve(2e18); // less than the 5e18 the rate implies

        vm.warp(start + 14 days);
        _finish(cid, a);
        _finalizeAndSettle(cid); // pays what the reserve holds instead of reverting
        assertEq(vault.payoutOf(cid, a), 102e18);
        assertEq(vault.bonusReserve(), 0);
        vm.prank(a); vault.withdraw(cid);
        assertEq(gd.balanceOf(address(vault)), 0);
    }

    function test_alreadySettledCohortCannotBeVoided() public {
        (uint256 cid, uint64 start) = _create(7);
        vm.prank(a); vault.stake(cid, 100e18);
        vm.warp(start + 7 days);
        _finalizeAndSettle(cid);
        // a cohort settled before the upgrade has settled = true and resultsFinal = false
        vm.store(address(vault), keccak256(abi.encode(cid, uint256(13))), bytes32(0)); // resultsFinal is at slot 13
        assertFalse(vault.resultsFinal(cid));
        vm.warp(start + 60 days);
        vm.expectRevert(StreakVaultUpgradeable.AlreadySettled.selector);
        vault.voidCohort(cid);
        assertEq(vault.payoutOf(cid, a), 0); // a forfeited and stays forfeited
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
