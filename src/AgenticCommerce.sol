// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address user) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract AgenticCommerce {

    /* =====================
        Core Config
    ===================== */

    address public merchant;
    address public usdcToken;
    bool public paused;

    mapping(uint256 => uint256) public productPrices;

    /* =====================
        Replay Protection
    ===================== */

    mapping(bytes32 => bool) public usedReceipts;

    /* =====================
        Subscriptions
    ===================== */

    mapping(address => uint256) public subscriptionExpiry;

    /* =====================
        Events
    ===================== */

    event ProductPaid(address indexed buyer, uint256 indexed productId, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);
    event Subscribed(address indexed user, uint256 expiry);

    /* =====================
        Constructor
    ===================== */

    constructor(address _usdcToken) {
        merchant = msg.sender;
        usdcToken = _usdcToken;
    }

    /* =====================
        Modifiers
    ===================== */

    modifier onlyMerchant() {
        require(msg.sender == merchant, "Not merchant");
        _;
    }

    modifier notPaused() {
        require(!paused, "Payments paused");
        _;
    }

    /* =====================
        Admin
    ===================== */

    function setProductPrice(uint256 productId, uint256 price) external onlyMerchant {
        productPrices[productId] = price;
    }

    function pausePayments() external onlyMerchant {
        paused = true;
    }

    function resumePayments() external onlyMerchant {
        paused = false;
    }

    /* =====================
        Payments (x402)
    ===================== */

    function payForProduct(
        uint256 productId,
        string calldata task,
        bytes32 receiptId
    ) external notPaused {

        require(!usedReceipts[receiptId], "Receipt already used");
        usedReceipts[receiptId] = true;

        uint256 price = productPrices[productId];
        require(price > 0, "Product not priced");

        IERC20(usdcToken).transferFrom(msg.sender, address(this), price);

        emit ProductPaid(msg.sender, productId, price);
    }

    /* =====================
        Subscriptions
    ===================== */

    function subscribe(uint256 durationDays, uint256 amount) external notPaused {
        IERC20(usdcToken).transferFrom(msg.sender, address(this), amount);

        uint256 expiry = block.timestamp + (durationDays * 1 days);
        subscriptionExpiry[msg.sender] = expiry;

        emit Subscribed(msg.sender, expiry);
    }

    function hasActiveSubscription(address user) external view returns (bool) {
        return subscriptionExpiry[user] > block.timestamp;
    }

    /* =====================
        Refunds
    ===================== */

    function refund(address buyer, uint256 amount) external onlyMerchant {
        IERC20(usdcToken).transfer(buyer, amount);
        emit Refunded(buyer, amount);
    }

    /* =====================
        Withdraw
    ===================== */

    function withdraw() external onlyMerchant {
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));
        IERC20(usdcToken).transfer(merchant, balance);
    }
}
