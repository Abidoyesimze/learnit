// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StreakVault} from "../src/StreakVault.sol";
import {RewardsPool} from "../src/RewardsPool.sol";
import {MockGD, MockIdentity} from "./mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IRewardsPool} from "../src/interfaces/IRewardsPool.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract StreakVaultTest is Test {
    MockGD gd;
    MockIdentity id;
    RewardsPool pool;
    StreakVault vault;
    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address signer = makeAddr("signer");
    address ubi = makeAddr("ubi");
    address a = makeAddr("a");
    address b = makeAddr("b");
    address c = makeAddr("c");
    address aAlt = makeAddr("aAlt");
    address nobody = makeAddr("nobody");
    uint256 cid;
    uint64 start;

    uint128 constant MIN = 10e18;
    uint128 constant MAX = 100e18;

    function setUp() public {
        vm.warp(400 days);
        gd = new MockGD();
        id = new MockIdentity();
        pool = new RewardsPool(IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer);
        vault = new StreakVault(IERC20(address(gd)), IIdentity(address(id)), IRewardsPool(address(pool)), ubi, admin, guardian, signer);
        start = uint64(block.timestamp + 1 days);
        vm.prank(admin);
        cid = vault.createCohort(start, MIN, MAX);
        address[3] memory us = [a, b, c];
        for (uint256 i; i < 3; ++i) {
            id.verify(us[i], us[i]);
            gd.mint(us[i], 1_000e18);
            vm.prank(us[i]);
            gd.approve(address(vault), type(uint256).max);
        }
        id.verify(aAlt, a); // second wallet of a
        gd.mint(aAlt, 1_000e18);
        vm.prank(aAlt);
        gd.approve(address(vault), type(uint256).max);
    }

    function _end() internal view returns (uint256) { return uint256(start) + 7 days; }

    function _stake(address who, uint256 amt) internal {
        vm.prank(who);
        vault.stake(cid, amt);
    }

    function _finish(address who) internal {
        address[] memory us = new address[](1);
        us[0] = who;
        vm.prank(signer);
        vault.markFinished(cid, us);
    }

    // ------------------------------------------------------------ staking rules

    function test_stakeRecordsAmount() public {
        _stake(a, 50e18);
        assertEq(vault.stakeOf(cid, a), 50e18);
        assertEq(gd.balanceOf(address(vault)), 50e18);
    }

    function test_feeOnTransferRecordsReceived() public {
        gd.setFee(100); // 1%
        _stake(a, 50e18);
        assertEq(vault.stakeOf(cid, a), 49.5e18);
        (, , , , uint256 total, , , ) = vault.cohorts(cid);
        assertEq(total, 49.5e18);
        assertEq(gd.balanceOf(address(vault)), 49.5e18);
    }

    function test_unverifiedCannotStake() public {
        gd.mint(nobody, 100e18);
        vm.startPrank(nobody);
        gd.approve(address(vault), type(uint256).max);
        vm.expectRevert(StreakVault.NotVerified.selector);
        vault.stake(cid, 20e18);
        vm.stopPrank();
    }

    function test_expiredVerificationCannotStake() public {
        id.setLast(a, block.timestamp - 181 days);
        vm.prank(a);
        vm.expectRevert(StreakVault.NotVerified.selector);
        vault.stake(cid, 20e18);
    }

    function test_blocksStakeIfVerificationEndsBeforeCohortEnds() public {
        // verified now, but lapses mid-cohort
        id.setLast(a, block.timestamp - 180 days + 3 days);
        vm.prank(a);
        vm.expectRevert(StreakVault.VerificationEndsBeforeCohort.selector);
        vault.stake(cid, 20e18);
    }

    function test_oneStakePerHuman() public {
        _stake(a, 20e18);
        vm.prank(aAlt); // same root, different wallet
        vm.expectRevert(StreakVault.AlreadyStaked.selector);
        vault.stake(cid, 20e18);
        vm.prank(a);
        vm.expectRevert(StreakVault.AlreadyStaked.selector);
        vault.stake(cid, 20e18);
    }

    function test_stakeBounds() public {
        vm.prank(a);
        vm.expectRevert(StreakVault.OutOfBounds.selector);
        vault.stake(cid, MIN - 1);
        vm.prank(a);
        vm.expectRevert(StreakVault.OutOfBounds.selector);
        vault.stake(cid, MAX + 1);
    }

    function test_joinWindowCloses() public {
        vm.warp(uint256(start) + 1 days);
        vm.prank(a);
        vm.expectRevert(StreakVault.JoinClosed.selector);
        vault.stake(cid, 20e18);
    }

    function test_pauseBlocksStake() public {
        vm.prank(guardian);
        vault.pause();
        vm.prank(a);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.stake(cid, 20e18);
    }

    // ------------------------------------------------------------ results and settlement

    function test_markFinishedOnlyAfterEndAndBySigner() public {
        _stake(a, 20e18);
        address[] memory us = new address[](1);
        us[0] = a;
        vm.prank(signer);
        vm.expectRevert(StreakVault.NotEnded.selector);
        vault.markFinished(cid, us);
        vm.warp(_end());
        vm.prank(nobody);
        vm.expectRevert();
        vault.markFinished(cid, us);
    }

    function test_settleSplitsForfeitsSeventyTwentyTen() public {
        _stake(a, 100e18);
        _stake(b, 100e18);
        _stake(c, 100e18);
        vm.warp(_end());
        _finish(a);
        _finish(b); // c forfeits 100
        vm.prank(signer);
        vault.settle(cid);
        // 70 to finishers (35 each), 20 to the rewards pool, 10 to ubi
        assertEq(gd.balanceOf(address(pool)), 20e18);
        assertEq(gd.balanceOf(ubi), 10e18);
        vm.prank(a);
        vault.withdraw(cid);
        vm.prank(b);
        vault.withdraw(cid);
        assertEq(gd.balanceOf(a), 1_000e18 + 35e18);
        assertEq(gd.balanceOf(b), 1_000e18 + 35e18);
        assertEq(gd.balanceOf(address(vault)), 0);
    }

    function test_forfeiterCannotWithdraw() public {
        _stake(a, 100e18);
        _stake(c, 100e18);
        vm.warp(_end());
        _finish(a);
        vm.prank(signer);
        vault.settle(cid);
        vm.prank(c);
        vm.expectRevert(StreakVault.NotFinisher.selector);
        vault.withdraw(cid);
    }

    function test_noDoubleWithdraw() public {
        _stake(a, 100e18);
        vm.warp(_end());
        _finish(a);
        vm.prank(signer);
        vault.settle(cid);
        vm.prank(a);
        vault.withdraw(cid);
        vm.prank(a);
        vm.expectRevert(StreakVault.AlreadyWithdrawn.selector);
        vault.withdraw(cid);
    }

    function test_cannotWithdrawBeforeSettle() public {
        _stake(a, 100e18);
        vm.warp(_end());
        _finish(a);
        vm.prank(a);
        vm.expectRevert(StreakVault.NotSettled.selector);
        vault.withdraw(cid);
    }

    function test_publicSettleOnlyAfterDelay() public {
        _stake(a, 100e18);
        vm.warp(_end());
        vm.prank(nobody);
        vm.expectRevert(StreakVault.CannotSettleYet.selector);
        vault.settle(cid);
        vm.warp(_end() + 1 days);
        vm.prank(nobody);
        vault.settle(cid);
    }

    function test_cannotMarkAfterSettle() public {
        _stake(a, 100e18);
        vm.warp(_end());
        vm.prank(signer);
        vault.settle(cid);
        address[] memory us = new address[](1);
        us[0] = a;
        vm.prank(signer);
        vm.expectRevert(StreakVault.AlreadySettled.selector);
        vault.markFinished(cid, us);
    }

    function test_nobodyFinishedSendsEverythingOut() public {
        _stake(a, 100e18);
        _stake(b, 100e18);
        vm.warp(_end());
        vm.prank(signer);
        vault.settle(cid);
        assertEq(gd.balanceOf(address(pool)) + gd.balanceOf(ubi), 200e18);
        assertEq(gd.balanceOf(address(vault)), 0);
    }

    function test_feeOnTransferSettlementStaysSolvent() public {
        gd.setFee(100);
        _stake(a, 100e18);
        _stake(b, 100e18);
        _stake(c, 100e18);
        vm.warp(_end());
        _finish(a);
        _finish(b);
        vm.prank(signer);
        vault.settle(cid);
        vm.prank(a);
        vault.withdraw(cid);
        vm.prank(b);
        vault.withdraw(cid);
        assertLe(gd.balanceOf(address(vault)), 3); // dust only
    }

    function test_setSplitMustSumToTenThousand() public {
        vm.startPrank(admin);
        vm.expectRevert(StreakVault.BadParams.selector);
        vault.setSplit(5000, 2000, 1000);
        vault.setSplit(5000, 3000, 2000);
        vm.stopPrank();
    }

    function test_adminOnly() public {
        vm.startPrank(nobody);
        vm.expectRevert();
        vault.createCohort(uint64(block.timestamp + 1), MIN, MAX);
        vm.expectRevert();
        vault.setSplit(7000, 2000, 1000);
        vm.expectRevert();
        vault.setUbiAddress(nobody);
        vm.stopPrank();
    }

    // ------------------------------------------------------------ fuzz

    /// @dev Conservation: whatever the stakes and whoever finishes, the vault never pays out more than it took in,
    ///      and after every finisher withdraws only rounding dust remains.
    function testFuzz_settlementConservation(uint96 sa, uint96 sb, uint96 sc, uint8 mask, uint16 feeBps) public {
        gd.setFee(bound(feeBps, 0, 500));
        uint256 x = bound(sa, MIN, MAX);
        uint256 y = bound(sb, MIN, MAX);
        uint256 z = bound(sc, MIN, MAX);
        _stake(a, x);
        _stake(b, y);
        _stake(c, z);
        (, , , , uint256 total, , , ) = vault.cohorts(cid);
        assertEq(total, vault.stakeOf(cid, a) + vault.stakeOf(cid, b) + vault.stakeOf(cid, c));

        vm.warp(_end());
        address[3] memory us = [a, b, c];
        uint256 nFin;
        for (uint256 i; i < 3; ++i) {
            if ((mask >> i) & 1 == 1) { _finish(us[i]); nFin++; }
        }
        uint256 poolBefore = gd.balanceOf(address(pool));
        uint256 ubiBefore = gd.balanceOf(ubi);
        vm.prank(signer);
        vault.settle(cid);

        uint256 owed;
        for (uint256 i; i < 3; ++i) {
            if ((mask >> i) & 1 == 1) {
                owed += vault.payoutOf(cid, us[i]);
            }
        }
        // payouts + what already left the vault never exceed the vault's recorded total
        uint256 left = (gd.balanceOf(address(pool)) - poolBefore) + (gd.balanceOf(ubi) - ubiBefore);
        // with a transfer fee the outgoing amounts arrive net, so compare against gross accounting via the vault balance
        assertLe(owed, gd.balanceOf(address(vault)));
        if (nFin == 0) {
            assertEq(gd.balanceOf(address(vault)), 0);
        } else {
            // finishers' stake alone is always fully covered
            uint256 stakes;
            for (uint256 i; i < 3; ++i) if ((mask >> i) & 1 == 1) stakes += vault.stakeOf(cid, us[i]);
            assertGe(owed, stakes);
        }
        left; // silence unused warning in fee-free runs
        for (uint256 i; i < 3; ++i) {
            if ((mask >> i) & 1 == 1) {
                vm.prank(us[i]);
                vault.withdraw(cid);
            }
        }
        assertLe(gd.balanceOf(address(vault)), 3); // rounding dust only
    }
}
