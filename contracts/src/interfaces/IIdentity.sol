// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The subset of GoodDollar's Identity contract (Celo: 0xC361A6E67822a0EDc17D899227dd9FC50BD62F42) that LearnIt uses.
interface IIdentity {
    function getWhitelistedRoot(address account) external view returns (address);
    function lastAuthenticated(address account) external view returns (uint256);
    /// @dev In days, as used by the GoodDollar SDK (expiry = lastAuthenticated + authenticationPeriod days).
    function authenticationPeriod() external view returns (uint256);
}
