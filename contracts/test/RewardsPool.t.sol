// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RewardsPool} from "../src/RewardsPool.sol";
import {MockGD, MockIdentity} from "./mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract RewardsPoolTest is Test {
    MockGD gd;
    MockIdentity id;
    RewardsPool pool;
    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address alice = makeAddr("alice");
    address aliceAlt = makeAddr("aliceAlt"); // second wallet of the same human
    address bob = makeAddr("bob");
    address root = makeAddr("aliceRoot");
    address mallory = makeAddr("mallory"); // unverified
    address signer;
    uint256 signerKey;

    function setUp() public {
        vm.warp(400 days);
        (signer, signerKey) = makeAddrAndKey("signer");
        gd = new MockGD();
        id = new MockIdentity();
        pool = new RewardsPool(IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer);
        vm.startPrank(admin);
        pool.setCaps(10e18, 30e18);
        pool.setDailyBudget(100e18);
        vm.stopPrank();
        gd.mint(address(this), 1_000e18);
        gd.approve(address(pool), type(uint256).max);
        pool.deposit(1_000e18);
        id.verify(alice, root);
        id.verify(aliceAlt, root);
        id.verify(bob, bob);
    }

    function _voucher(address r, uint256 amount, uint256 nonce) internal view returns (RewardsPool.Voucher memory) {
        return RewardsPool.Voucher(r, amount, nonce, block.timestamp + 1 days);
    }

    /// @dev signs first: _sign makes an external call that would otherwise consume the prank.
    function _claimAs(address who, RewardsPool.Voucher memory v) internal {
        bytes memory sig = _sign(v, signerKey);
        vm.prank(who);
        pool.claim(v, sig);
    }

    function _sign(RewardsPool.Voucher memory v, uint256 key) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, pool.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    function test_claim_paysVerifiedUser() public {
        RewardsPool.Voucher memory v = _voucher(root, 5e18, 1);
        _claimAs(alice, v);
        assertEq(gd.balanceOf(alice), 5e18);
    }

    function test_nonceReplayReverts() public {
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 7);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        pool.claim(v, sig);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.NonceUsed.selector);
        pool.claim(v, sig);
        // the other wallet of the same root cannot replay it either
        vm.prank(aliceAlt);
        vm.expectRevert(RewardsPool.NonceUsed.selector);
        pool.claim(v, sig);
    }

    function test_unverifiedReverts() public {
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(mallory);
        vm.expectRevert(RewardsPool.NotVerified.selector);
        pool.claim(v, sig);
    }

    function test_expiredVerificationReverts() public {
        id.setLast(root, block.timestamp - 181 days);
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.NotVerified.selector);
        pool.claim(v, sig);
    }

    function test_voucherForAnotherRootReverts() public {
        RewardsPool.Voucher memory v = _voucher(bob, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.WrongRoot.selector);
        pool.claim(v, sig);
    }

    function test_badSignerReverts() public {
        (, uint256 otherKey) = makeAddrAndKey("other");
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, otherKey);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.BadSignature.selector);
        pool.claim(v, sig);
    }

    function test_expiredVoucherReverts() public {
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.Expired.selector);
        pool.claim(v, sig);
    }

    function test_tamperedAmountReverts() public {
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        v.amount = 9e18;
        vm.prank(alice);
        vm.expectRevert(RewardsPool.BadSignature.selector);
        pool.claim(v, sig);
    }

    function test_dailyCapIsPerRootNotPerWallet() public {
        RewardsPool.Voucher memory a = _voucher(root, 6e18, 1);
        RewardsPool.Voucher memory b = _voucher(root, 6e18, 2);
        _claimAs(alice, a);
        bytes memory sigB = _sign(b, signerKey);
        vm.prank(aliceAlt); // same human, other wallet
        vm.expectRevert(RewardsPool.DailyCapExceeded.selector);
        pool.claim(b, sigB);
    }

    function test_weeklyCap() public {
        for (uint256 i; i < 3; ++i) {
            RewardsPool.Voucher memory v = _voucher(root, 10e18, i);
            _claimAs(alice, v);
            vm.warp(block.timestamp + 1 days);
        }
        // 30e18 claimed this week (if the days fall in one week); a 4th would break the weekly cap or start a new week
        uint256 week = (block.timestamp / 1 days) / 7;
        uint256 used = pool.claimedInWeek(root, week);
        RewardsPool.Voucher memory extra = _voucher(root, 10e18, 99);
        if (used >= 30e18) {
            bytes memory sig = _sign(extra, signerKey);
            vm.prank(alice);
            vm.expectRevert(RewardsPool.WeeklyCapExceeded.selector);
            pool.claim(extra, sig);
        }
    }

    function test_weeklyCapExact() public {
        vm.startPrank(admin);
        pool.setCaps(10e18, 15e18);
        vm.stopPrank();
        // land on the first day of a week so both claims share it
        uint256 weekStart = ((block.timestamp / 1 days) / 7 + 1) * 7 * 1 days;
        vm.warp(weekStart);
        RewardsPool.Voucher memory a = _voucher(root, 10e18, 1);
        _claimAs(alice, a);
        vm.warp(weekStart + 1 days);
        RewardsPool.Voucher memory b = _voucher(root, 10e18, 2);
        bytes memory sig = _sign(b, signerKey);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.WeeklyCapExceeded.selector);
        pool.claim(b, sig);
    }

    function test_globalDailyBudget() public {
        vm.prank(admin);
        pool.setDailyBudget(12e18);
        RewardsPool.Voucher memory a = _voucher(root, 8e18, 1);
        _claimAs(alice, a);
        RewardsPool.Voucher memory b = _voucher(bob, 8e18, 1);
        bytes memory sig = _sign(b, signerKey);
        vm.prank(bob);
        vm.expectRevert(RewardsPool.BudgetExceeded.selector);
        pool.claim(b, sig);
        // resets next day
        vm.warp(block.timestamp + 1 days);
        RewardsPool.Voucher memory c = _voucher(bob, 8e18, 2);
        _claimAs(bob, c);
    }

    function test_claimBatch() public {
        RewardsPool.Voucher[] memory vs = new RewardsPool.Voucher[](2);
        bytes[] memory sigs = new bytes[](2);
        vs[0] = _voucher(root, 3e18, 1);
        vs[1] = _voucher(root, 4e18, 2);
        sigs[0] = _sign(vs[0], signerKey);
        sigs[1] = _sign(vs[1], signerKey);
        vm.prank(alice);
        pool.claimBatch(vs, sigs);
        assertEq(gd.balanceOf(alice), 7e18);
    }

    function test_claimBatchLengthMismatch() public {
        RewardsPool.Voucher[] memory vs = new RewardsPool.Voucher[](1);
        bytes[] memory sigs = new bytes[](0);
        vm.prank(alice);
        vm.expectRevert(RewardsPool.LengthMismatch.selector);
        pool.claimBatch(vs, sigs);
    }

    function test_pauseBlocksClaims() public {
        vm.prank(guardian);
        pool.pause();
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        pool.claim(v, sig);
        vm.prank(guardian);
        pool.unpause();
        vm.prank(alice);
        pool.claim(v, sig);
    }

    function test_changingSignerCancelsOutstandingVouchers() public {
        RewardsPool.Voucher memory v = _voucher(root, 1e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(admin);
        pool.setSigner(makeAddr("newSigner"));
        vm.prank(alice);
        vm.expectRevert(RewardsPool.BadSignature.selector);
        pool.claim(v, sig);
    }

    function test_adminFunctionsAreRestricted() public {
        vm.startPrank(mallory);
        vm.expectRevert();
        pool.setCaps(1, 1);
        vm.expectRevert();
        pool.setSigner(mallory);
        vm.expectRevert();
        pool.setDailyBudget(1);
        vm.expectRevert();
        pool.pause();
        vm.stopPrank();
    }

    function test_depositWithFeeEmitsReceived() public {
        gd.setFee(100); // 1%
        gd.mint(bob, 100e18);
        vm.startPrank(bob);
        gd.approve(address(pool), 100e18);
        vm.expectEmit(true, false, false, true);
        emit RewardsPool.Deposited(bob, 99e18);
        pool.deposit(100e18);
        vm.stopPrank();
    }

    function testFuzz_neverPaysPastCaps(uint96 a1, uint96 a2) public {
        uint256 x = bound(a1, 1, 10e18);
        uint256 y = bound(a2, 1, 10e18);
        RewardsPool.Voucher memory v1 = _voucher(root, x, 1);
        _claimAs(alice, v1);
        RewardsPool.Voucher memory v2 = _voucher(root, y, 2);
        bytes memory sig = _sign(v2, signerKey);
        vm.prank(alice);
        if (x + y > 10e18) {
            vm.expectRevert(RewardsPool.DailyCapExceeded.selector);
        }
        pool.claim(v2, sig);
        assertLe(gd.balanceOf(alice), 10e18);
    }
}
