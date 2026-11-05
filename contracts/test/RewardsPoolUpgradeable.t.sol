// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {RewardsPoolUpgradeable} from "../src/RewardsPoolUpgradeable.sol";
import {RewardsPoolUpgradeableV2Mock} from "./mocks/UpgradeMocks.sol";
import {MockGD, MockIdentity} from "./mocks/Mocks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentity} from "../src/interfaces/IIdentity.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @dev Covers proxy init + upgrade mechanics. Day-to-day claim/cap/signature behavior is unchanged
///      from RewardsPool.sol (same logic, same tests passing there); this file does not re-derive it.
contract RewardsPoolUpgradeableTest is Test {
    MockGD gd;
    MockIdentity id;
    RewardsPoolUpgradeable pool;
    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address alice = makeAddr("alice");
    address root = makeAddr("aliceRoot");
    address signer;
    uint256 signerKey;

    function setUp() public {
        vm.warp(400 days);
        (signer, signerKey) = makeAddrAndKey("signer");
        gd = new MockGD();
        id = new MockIdentity();

        RewardsPoolUpgradeable impl = new RewardsPoolUpgradeable();
        bytes memory initData = abi.encodeCall(RewardsPoolUpgradeable.initialize, (IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer, 10e18, 30e18, 100e18));
        pool = RewardsPoolUpgradeable(address(new ERC1967Proxy(address(impl), initData)));

        gd.mint(address(this), 1_000e18);
        gd.approve(address(pool), type(uint256).max);
        pool.deposit(1_000e18);
        id.verify(alice, root);
    }

    function _voucher(address r, uint256 amount, uint256 nonce) internal view returns (RewardsPoolUpgradeable.Voucher memory) {
        return RewardsPoolUpgradeable.Voucher(r, amount, nonce, block.timestamp + 1 days);
    }

    function _sign(RewardsPoolUpgradeable.Voucher memory v, uint256 key) internal view returns (bytes memory) {
        (uint8 vv, bytes32 r, bytes32 s) = vm.sign(key, pool.hashVoucher(v));
        return abi.encodePacked(r, s, vv);
    }

    // ------------------------------------------------------------ proxy wiring sanity

    function test_initializedThroughProxy_claimWorks() public {
        RewardsPoolUpgradeable.Voucher memory v = _voucher(root, 5e18, 1);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        pool.claim(v, sig);
        assertEq(gd.balanceOf(alice), 5e18);
    }

    function test_cannotInitializeTwice() public {
        vm.expectRevert();
        pool.initialize(IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer, 10e18, 30e18, 100e18);
    }

    function test_implementationItselfCannotBeInitialized() public {
        RewardsPoolUpgradeable impl = new RewardsPoolUpgradeable();
        vm.expectRevert();
        impl.initialize(IERC20(address(gd)), IIdentity(address(id)), admin, guardian, signer, 10e18, 30e18, 100e18);
    }

    // ------------------------------------------------------------ upgrade mechanics

    function test_adminCanUpgradeAndStateSurvives() public {
        RewardsPoolUpgradeableV2Mock v2 = new RewardsPoolUpgradeableV2Mock();
        vm.prank(admin);
        pool.upgradeToAndCall(address(v2), "");

        // storage (caps set before the upgrade) is untouched
        assertEq(pool.dailyCap(), 10e18);
        assertEq(pool.weeklyCap(), 30e18);
        // and the new logic is live
        assertEq(RewardsPoolUpgradeableV2Mock(address(pool)).version(), "v2");

        // claiming still works post-upgrade, against the same stored signer/caps
        RewardsPoolUpgradeable.Voucher memory v = _voucher(root, 5e18, 2);
        bytes memory sig = _sign(v, signerKey);
        vm.prank(alice);
        pool.claim(v, sig);
        assertEq(gd.balanceOf(alice), 5e18);
    }

    function test_nonAdminCannotUpgrade() public {
        RewardsPoolUpgradeableV2Mock v2 = new RewardsPoolUpgradeableV2Mock();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, bytes32(0)));
        pool.upgradeToAndCall(address(v2), "");
    }

    function test_guardianCannotUpgrade() public {
        RewardsPoolUpgradeableV2Mock v2 = new RewardsPoolUpgradeableV2Mock();
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, guardian, bytes32(0)));
        pool.upgradeToAndCall(address(v2), "");
    }
}
