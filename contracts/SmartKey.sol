// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IERC4519.sol";

contract SmartKey is ERC721, IERC4519 {

    enum States { WaitingForOwner, EngagedWithOwner, WaitingForUser, EngagedWithUser }

    uint256 constant private _minimumTimeout = 900;                  //Miners can manipulate up to 900s.

    address private _manufacturer;                                   //Address of manufacturer and owner of Smart Contract
    uint256 private _tokenCounter;                                   //To give a genuine tokenID based on the number of tokens created
    mapping(address => address) private _ownerOfCar;
    mapping(address => uint256) private _tokenIDOfCar;               //To know which is the tokenID associated to a secure device
    mapping(address => uint256) private _userBalances;                //To know how many tokens a user can use

    struct Token_Struct{
        address owner;                                   //Indicate who can transfer this token, 0 if no one
        address car;                                         //Indicate the BCA of the secure device associated to this token
        address user;                                       //Indicate who can use this secure device
        States state;                                       //If blocked (false) then token should be verified by new user or new owner
        uint256 hashK_OD;                                   //Hash of the Key shared between owner and device
        uint256 hashK_UD;                                   //Hash of the Key shared between user and device
        uint256 dataEngagement;                             //Public Key to create K_OD or K_UD depending on token state
        uint256 timestamp;                                  //Last time that device updated its proof of live
        uint256 timeout;                                    //timeout to verify a device error
    }

    mapping(uint256 => Token_Struct) private _tokens;

    constructor() ERC721("SmartNFTKey", "SNK") {
        _manufacturer = msg.sender;
        _tokenCounter = 0;
    }

    /* ERC165 */
    function supportsInterface(bytes4 interfaceId) public virtual view override(ERC721)
    returns (bool) {
        return interfaceId == type(IERC4519).interfaceId
        || super.supportsInterface(interfaceId);
    }

    /* ERC4519 */
    function setUser(uint256 _tokenId, address _addressUser) external override payable {

    }

    function startOwnerEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_OA) external override payable {

    }


    function ownerEngagement(uint256 _hashK_A) external override payable {

    }

    function startUserEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_UA) external override payable {

    }


    function userEngagement(uint256 _hashK_A) external override payable {

    }


    function checkTimeout(uint256 _tokenId) external override
    returns (bool) {

        return false;
    }


    function setTimeout(uint256 _tokenId, uint256 _timeout) external override {
        require(_timeout >= _minimumTimeout);
        _tokens[_tokenId].timeout = _timeout;
    }


    function updateTimestamp() external override {

        uint256 tokenId = this.tokenFromBCA(msg.sender);
        require(ERC721._exists(tokenId));
        _tokens[tokenId].timestamp = block.timestamp;
    }


    function tokenFromBCA(address _addressAsset) external view override
    returns (uint256) {

        return _tokenIDOfCar[_addressAsset];
    }

    function _existFromBCA(address _addressAsset) internal view returns (bool) {

        return _tokenIDOfCar[_addressAsset] != 0;
    }


    function ownerOfFromBCA(address _addressAsset) external view override
    returns (address) {

        return _ownerOfCar[_addressAsset];
    }


    function userOf(uint256 _tokenId) external view override
    returns (address) {

        return _tokens[_tokenId].user;
    }


    function userOfFromBCA(address _addressAsset) external view override
    returns (address) {

        return this.userOf(this.tokenFromBCA(_addressAsset));
    }


    function userBalanceOf(address _addressUser) external view override
    returns (uint256) {

        return _userBalances[_addressUser];
    }


    function userBalanceOfAnOwner(address _addressUser, address _addressOwner) external view override
    returns (uint256) {

        return 0;
    }

    function createToken(address _addressAsset, address _addressOwner) external {

        require(_manufacturer == msg.sender, "[SmartKey] Only the manufacturer can create new tokens.");
        require(_addressAsset != address(0), "[SmartKey] Device address must be allocated!");
        require(_addressOwner != address(0), "[SmartKey] Owner address must be allocated!");

        uint256 newTokenId = _generateTokenIdFrom(_addressAsset);
        require(!ERC721._exists(newTokenId), "[SmartKey] Duplicated minting is not allowed!");

        ERC721._safeMint(_addressOwner, newTokenId);

        _tokens[newTokenId] = Token_Struct(
            _addressOwner, _addressAsset, address(0), States.WaitingForOwner, 0, 0, 0, block.timestamp, _minimumTimeout);
        _ownerOfCar[_addressAsset] = _addressOwner;
        _tokenIDOfCar[_addressAsset] = newTokenId;
        _tokenCounter++;
    }

    function burnToken(uint256 tokenId) external {

        require(ERC721._exists(tokenId), "[SmartKey] Such token does not exist.");
        require(ERC721.ownerOf(tokenId) == msg.sender, "[SmartKey] Only owner can burn this token.");

        ERC721._burn(tokenId);

        address addressAsset = _tokens[tokenId].car;
        delete _ownerOfCar[addressAsset];
        delete _tokenIDOfCar[addressAsset];
        delete _tokens[tokenId];
        _tokenCounter--;
    }

    function _generateTokenIdFrom(address _addressAsset) internal pure returns (uint256) {
        return uint256(uint160(_addressAsset));
    }

    function totalTokens() external view returns (uint256) {
        return _tokenCounter;
    }
}