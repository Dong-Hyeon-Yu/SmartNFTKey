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
                _checkState(tokenId, TokenStorage.States.EngagedWithOwner),
                "[SmartKey] Token can be transferred only under \"EngagedWithOwner\" mode"
            );
        }
    }

    function getById(uint256 tokenId) external view returns (TokenStorage.Token_Struct memory) {
        return _storage.findById(tokenId);
    }

    /* ERC-4519 */
    function setUser(uint256 _tokenId, address _addressUser) external override payable {

    }

    function startOwnerEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_OA) external override payable {
        require(ownerOf(_tokenId) == msg.sender, "[SmartKey] Access denied: Owner can call this function only.");
        require(
            _checkState(_tokenId, TokenStorage.States.WaitingForOwner)
            || _checkState(_tokenId, TokenStorage.States.EngagedWithOwner)
        );

        require(_checkTimeout(_tokenId), "[SmartKey] Timeout occurred. The device may has problems.");
        _startOwnerEngagement(_tokenId, _dataEngagement, _hashK_OA);

    }

    function _startOwnerEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_OA) private {
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

        _checkIntegrityOfSecretKey(tokenId, _hashK_A);

        _ownerEngagement(tokenId);
    }

    function _checkIntegrityOfSecretKey(uint256 tokenId, uint256 _hashK_A) internal view {
        TokenStorage.Token_Struct memory target = _storage.findById(tokenId);
        require(target.dataEngagement != 0, "[SmartNFT] Owner has not started to setup yet.");
        require(target.hashK_OD == _hashK_A, "[SmartNFT] ECDH setup fail.");
    }

    function _ownerEngagement(uint256 tokenId) internal {
        TokenStorage.Token_Struct memory param = _storage.findById(tokenId);
        param.state = TokenStorage.States.EngagedWithOwner;
        param.dataEngagement = 0;
        _storage.update(tokenId, param);
        _updateTimestamp(tokenId);

        emit OwnerEngaged(tokenId);
    }

    function startUserEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_UA) external override payable {

    }

    function userEngagement(uint256 _hashK_A) external override payable {

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
//            _tokens[_tokenId].user = address(0);
            emit TimeoutAlarm(_tokenId);
        }
        return itsFine;
    }

    function setTimeout(uint256 _tokenId, uint256 _timeout) external override {
        require(_timeout >= _minimumTimeout);
//        _tokens[_tokenId].timeout = _timeout;
    }

    function _setTimeout(uint256 _tokenId, uint256 _timeout) internal {

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
        return address(0);
//        return _tokens[_tokenId].user;
    }

    function userOfFromBCA(address _addressAsset) external view override
    returns (address) {
        return address(0);
//        return _tokens[_tokenFromBCA(_addressAsset)].user;
    }

    function userBalanceOf(address _addressUser) external view override
    returns (uint256) {
        return 0;
//        return _userBalances[_addressUser];
    }

    function userBalanceOfAnOwner(address _addressUser, address _addressOwner) external view override
    returns (uint256) {

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

}
