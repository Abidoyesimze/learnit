// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IIdentity} from "../../src/interfaces/IIdentity.sol";

/// @dev G$-like token with an optional transfer fee (burned from the amount sent).
contract MockGD is ERC20 {
    uint256 public feeBps;

    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setFee(uint256 bps) external { feeBps = bps; }

    function _update(address from, address to, uint256 value) internal override {
        if (feeBps > 0 && from != address(0) && to != address(0)) {
            uint256 fee = value * feeBps / 10_000;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

contract MockIdentity is IIdentity {
    mapping(address => address) public roots;
    mapping(address => uint256) public last;
    uint256 public period = 180; // days

    function verify(address account, address root) external {
        roots[account] = root;
        roots[root] = root;
        last[root] = block.timestamp;
    }
    function unverify(address account) external { roots[account] = address(0); }
    function setLast(address root, uint256 t) external { last[root] = t; }
    function setPeriod(uint256 d) external { period = d; }

    function getWhitelistedRoot(address a) external view returns (address) { return roots[a]; }
    function lastAuthenticated(address a) external view returns (uint256) { return last[a]; }
    function authenticationPeriod() external view returns (uint256) { return period; }
}
