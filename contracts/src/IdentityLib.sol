// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentity} from "./interfaces/IIdentity.sol";

library IdentityLib {
    /// @return root the whitelisted root of `account`, or address(0) if not whitelisted
    /// @return expiry timestamp when the root's verification lapses (0 if unknown)
    function rootAndExpiry(IIdentity id, address account) internal view returns (address root, uint256 expiry) {
        root = id.getWhitelistedRoot(account);
        if (root == address(0)) return (root, 0);
        expiry = id.lastAuthenticated(root) + id.authenticationPeriod() * 1 days;
    }
}
