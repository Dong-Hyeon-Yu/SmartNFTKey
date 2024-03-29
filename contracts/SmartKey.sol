// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./ERC721.sol";
import "./interfaces/IERC4519.sol";

contract SmartKey is ERC721, IERC4519 {

    address private _manufacturer;
    uint256 constant private _minimumTimeout = 900;         //Todo: search about minimumTimeout

    constructor(TokenStorage tokenStorage) ERC721("SmartNFTKey", "SNK", tokenStorage) {
        _manufacturer = msg.sender;
    }

    modifier _ownerOnly_(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "[SmartKey] Access denied: Only the owner can call this function.");
        _;
    }
    modifier _checkTimeout_(uint256 tokenId) {
        require(_checkTimeout(tokenId), "[SmartKey] Timeout occurred. The device may has problems.");
        _;
    }

    /* ERC-165 */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
        interfaceId == type(IERC4519).interfaceId ||
        super.supportsInterface(interfaceId);
    }

    /* modified ERC-721 */
//    function safeMint(address addressAsset, address addressOwner, bytes calldata data) external payable {
//        _safeMint(addressOwner, _generateTokenIdFrom(addressAsset), addressAsset, data);
//    }

    function safeMint(address addressAsset, address addressOwner) external payable {
        require(_manufacturer == msg.sender, "[SmartKey] Only the manufacturer can create new tokens.");
        _safeMint(addressOwner, _generateTokenIdFrom(addressAsset), addressAsset);
    }

    function _generateTokenIdFrom(address _addressAsset) internal pure returns (uint256) {
        return uint256(uint160(_addressAsset));
    }

    function burn(uint256 tokenId) external {
        _burn(tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256  tokenId , uint256 /*batchSize*/) internal virtual override {
        if (from != address(0) && to != address(0)) {
            require(
                !_checkState(tokenId, TokenStorage.States.WaitingForOwner),
                "[SmartKey] Token can't be transferred in \"WaitingForOwner\" mode"
            );
        }
    }

    function getById(uint256 tokenId) external view returns (TokenStorage.Token_Struct memory) {
        return _storage.findById(tokenId);
    }

    /* ERC-4519 */
    function startOwnerEngagement(
        uint256 _tokenId,
        uint256 _dataEngagement,
        uint256 _hashK_OA
    ) external _ownerOnly_(_tokenId) _checkTimeout_(_tokenId) override payable {

        require(
            _checkState(_tokenId, TokenStorage.States.WaitingForOwner)
            || _checkState(_tokenId, TokenStorage.States.EngagedWithOwner)
        );

        _startOwnerEngagement(_tokenId, _dataEngagement, _hashK_OA);
    }

    function _startOwnerEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_OA) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(_tokenId);
        param.dataEngagement = _dataEngagement;
        param.hashK_OD = _hashK_OA;
        _storage.update(_tokenId, param);
    }

    function ownerEngagement(uint256 _hashK_A) external override payable {
        uint256 tokenId = this.tokenFromBCA(msg.sender);
        require(
            _checkState(tokenId, TokenStorage.States.WaitingForOwner)
            || _checkState(tokenId, TokenStorage.States.EngagedWithOwner)
        );

        _checkIntegrityOfOwnerSecretKey(tokenId, _hashK_A);

        _ownerEngagement(tokenId);
        _updateTimestamp(tokenId);
    }

    function _checkIntegrityOfOwnerSecretKey(uint256 tokenId, uint256 _hashK_A) internal view {
        TokenStorage.Token_Struct memory target = _storage.findById(tokenId);
        require(target.dataEngagement != 0, "[SmartNFT] Owner has not started to setup yet.");
        require(target.hashK_OD == _hashK_A, "[SmartNFT] ECDH setup fail.");
    }

    function _ownerEngagement(uint256 tokenId) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(tokenId);
        param.state = TokenStorage.States.EngagedWithOwner;
        param.dataEngagement = 0;
        _storage.update(tokenId, param);

        emit OwnerEngaged(tokenId);
    }

    function setUser(
        uint256 _tokenId,
        address _addressUser
    ) external _ownerOnly_(_tokenId) _checkTimeout_(_tokenId) override payable {
        require(
            !_checkState(_tokenId, TokenStorage.States.WaitingForOwner),
            "[SmartKey] Cannot set user while waiting for new owner."
        );

        if (_addressUser == address(0)) {
            require(
                !_checkState(_tokenId, TokenStorage.States.EngagedWithOwner),
                "[SmartNFT] Redundant call. The result will not have any effect to the state of this contract."
            );
            _ownerEngagement(_tokenId);
        }
        else if (_addressUser == _ownerOf(_tokenId)) {
            _setState(_tokenId, TokenStorage.States.EngagedWithUser);
            emit UserEngaged(_tokenId);
        }
        else {
            _setState(_tokenId, TokenStorage.States.WaitingForUser);
            emit UserAssigned(_tokenId, _addressUser);
        }

        _setUser(_tokenId, _addressUser);
    }

    function _setUser(uint256 tokenId, address user) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(tokenId);
        param.user = user;
        param.dataEngagement = 0;
        param.hashK_UD = 0;
        _storage.update(tokenId, param);
    }

    function startUserEngagement(
        uint256 _tokenId,
        uint256 _dataEngagement,
        uint256 _hashK_UA
    ) external _checkTimeout_(_tokenId) override payable {
        require(this.userOf(_tokenId) == msg.sender, "[SmartKey] invalid user.");
        require(
            _checkState(_tokenId, TokenStorage.States.WaitingForUser),
            "[SmartKey] Currently not allowed to engage. Contact to the owner."
        );

        _startUserEngagement(_tokenId, _dataEngagement, _hashK_UA);
    }

    function _startUserEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_UA) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(_tokenId);
        param.dataEngagement = _dataEngagement;
        param.hashK_UD = _hashK_UA;
        _storage.update(_tokenId, param);
    }

    function userEngagement(uint256 _hashK_A) external override payable {
        uint256 tokenId = this.tokenFromBCA(msg.sender);
        require(_userOf(tokenId) != address(0), "[SmartKey] No user having been engaged.");
        require(
            _checkState(tokenId, TokenStorage.States.WaitingForUser),
            "[SmartKey] Currently not allowed to engage. Contact to the owner."
        );

        _checkIntegrityOfUserSecretKey(tokenId, _hashK_A);

        _userEngagement(tokenId);
        _updateTimestamp(tokenId);
    }

    function delegateUserEngagement(
        uint256 _requestType,
        uint256 _requestTimestamp,
        uint256 _nonce,
        bytes memory _user_signature
    ) external payable {
        uint256 tokenId = this.tokenFromBCA(msg.sender);
        address _assigned_user = _userOf(tokenId);
        require(_assigned_user != address(0), "[SmartKey] No user having been engaged.");
        require(
            _checkState(tokenId, TokenStorage.States.WaitingForUser),
            "[SmartKey] Currently not allowed to engage. Contact to the owner."
        );

        require(_requestType == 1, "[SmartKey] _requestType must be the value of authentication.");
        require(_verify(_assigned_user, _requestType, _requestTimestamp, _nonce, _user_signature), "[SmartKey] Signature is not matched to the user.");

        _userEngagement(tokenId);
        _updateTimestamp(tokenId);
    }

    function _verify(
        address _assigned_user,
        uint256 _requestType,
        uint256 _requestTimestamp,
        uint256 _nonce,
        bytes memory _signature
    ) internal pure returns (bool) {
        bytes32 _messageHash = keccak256(abi.encodePacked(_requestType, _requestTimestamp, _nonce));
        bytes32 _ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
        );

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);

        return ecrecover(_ethSignedMessageHash, v, r, s) == _assigned_user;
    }

    function _splitSignature(
        bytes memory sig
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
        /*
        First 32 bytes stores the length of the signature

        add(sig, 32) = pointer of sig + 32
        effectively, skips first 32 bytes of signature

        mload(p) loads next 32 bytes starting at the memory address p into memory
        */

        // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
        // second 32 bytes
            s := mload(add(sig, 64))
        // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        // implicitly return (r, s, v)
    }

    function _checkIntegrityOfUserSecretKey(uint256 tokenId, uint256 _hashK_A) internal view {
        TokenStorage.Token_Struct memory target = _storage.findById(tokenId);
        require(target.dataEngagement != 0, "[SmartNFT] Owner has not started to setup yet.");
        require(target.hashK_UD == _hashK_A, "[SmartNFT] ECDH setup fail.");
    }

    function _userEngagement(uint256 tokenId) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(tokenId);
        param.state = TokenStorage.States.EngagedWithUser;
        param.dataEngagement = 0;
        _storage.update(tokenId, param);

        emit UserEngaged(tokenId);
    }

    function checkTimeout(uint256 _tokenId) external override
    returns (bool) {
        _requireMinted(_tokenId);
        return _checkTimeout(_tokenId);
    }

    function _checkTimeout(uint256 _tokenId) internal returns (bool) {
        TokenStorage.Token_Struct memory target = _storage.findById(_tokenId);
        bool itsFine = target.timeout + target.timestamp > block.timestamp;
        if (!itsFine) {
            target.user = address(0);
            _storage.update(_tokenId, target);
            emit TimeoutAlarm(_tokenId);
        }
        return itsFine;
    }

    function setTimeout(uint256 _tokenId, uint256 _timeout) external _ownerOnly_(_tokenId) override {
        require(_timeout >= _minimumTimeout, "The timeout field must be larger than minimumTimeout");
        _setTimeout(_tokenId, _timeout);
    }

    function _setTimeout(uint256 _tokenId, uint256 _timeout) internal  {
        TokenStorage.Token_Struct memory target = _storage.findById(_tokenId);
        target.timeout = _timeout;
        _storage.update(_tokenId, target);
    }

    function updateTimestamp() external override {
        _updateTimestamp(this.tokenFromBCA(msg.sender));
    }

    function _updateTimestamp(uint256 _tokenId) internal {
        TokenStorage.Token_Struct memory target = _storage.findById(_tokenId);
        target.timestamp = block.timestamp;
        _storage.update(_tokenId, target);
    }

    function tokenFromBCA(address _addressAsset) external view override
    returns (uint256) {
        uint256 tokenId = _tokenOf(_addressAsset);
        require(tokenId != 0, "[SmartKey] Unregistered device.");
        return tokenId;
    }

    function ownerOfFromBCA(address _addressAsset) external view override
    returns (address) {

        return ownerOf(_tokenOf(_addressAsset));
    }

    function userOf(uint256 _tokenId) external view override
    returns (address) {
        address user = _storage.findById(_tokenId).user;
        require(user != address(0), "[SmartKey] No user allocated");
        return user;
    }

    function _userOf(uint256 _tokenId) internal view returns (address) {
        return _storage.findById(_tokenId).user;
    }

    function userOfFromBCA(address _addressAsset) external view override
    returns (address) {
        return this.userOf(this.tokenFromBCA(_addressAsset));
    }

    function userBalanceOf(address _addressUser) external view override
    returns (uint256) {
        require(_addressUser != address(0), "[SmartKey] Invalid user address");
        return _storage.getBalanceOfUser(_addressUser);
    }

    function userBalanceOfAnOwner(address _addressUser, address _addressOwner) external view override
    returns (uint256) {
        require(false, "[SmartKey] Not supported function.");
        return 0;
    }

    function _initializeToken(address _owner, address _device) internal view override
    returns (TokenStorage.Token_Struct memory){
        return TokenStorage.Token_Struct(
            _owner, _device, address(0), TokenStorage.States.WaitingForOwner, 0, 0, 0, block.timestamp, _minimumTimeout
        );
    }

    function _checkState(uint256 tokenId, TokenStorage.States _state) internal view returns (bool) {

        return _storage.findById(tokenId).state == _state;
    }

    function _setState(uint256 tokenId, TokenStorage.States _state) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(tokenId);
        param.state = _state;
        _storage.update(tokenId, param);
    }

}
