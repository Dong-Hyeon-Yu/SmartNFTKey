// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./interfaces/TokenStorage.sol";

contract TokenStorageImpl is TokenStorage {

    address private _manufacturer;                           //Address of manufacturer and owner of Smart Contract
    uint256 private _tokenCounter;                           //To give a genuine tokenID based on the number of tokens created

    mapping(uint256 => address) private _owners;            //Mapping from token ID to owner address
    mapping(address => address) private _ownerOfCar;
    mapping(address => uint256) private _tokenIdOfCar;      //To know which is the tokenID associated to a secure device
    mapping(address => uint256) private _ownerBalances;
    mapping(address => uint256) private _userBalances;      //To know how many tokens a user can use

    mapping(uint256 => Token_Struct) private _tokens;

    constructor(address manufacturer) {
        _manufacturer = manufacturer;
        _tokenCounter = 0;
    }

    modifier manufacturerOnly() {
        require(msg.sender == _manufacturer, "[TokenStorage] Access Denied.");
        _;
    }

    function findById(uint256 _tokenId) external view override returns (Token_Struct memory) {
        return _tokens[_tokenId];
    }

    function findByCar(address _addressAsset) external view override returns (uint256) {
        return _tokenIdOfCar[_addressAsset];
    }

    function findOwnerById(uint256 _tokenId) external view override returns (address) {
        return _owners[_tokenId];
    }

    function findOwnerByCar(address _addressAsset) external view override returns (address) {
        return _ownerOfCar[_addressAsset];
    }

    function getBalanceOfOwner(address _addressOwner) external view override returns (uint256) {
        return _ownerBalances[_addressOwner];
    }

    function getBalanceOfUser(address _addressUser) external view override returns (uint256) {
        return _userBalances[_addressUser];
    }

    function getTotalCount() external view override returns (uint256) {
        return _tokenCounter;
    }

    function save(uint256 _tokenId, Token_Struct calldata newToken) external manufacturerOnly override {
        require (_owners[_tokenId] == address(0), "[TokenStorage] TokenId already exists.");

        _tokens[_tokenId] = newToken;
        _owners[_tokenId] = newToken.owner;
        _ownerOfCar[newToken.car] = newToken.owner;
        _tokenIdOfCar[newToken.car] = _tokenId;
    unchecked {
        _ownerBalances[newToken.owner] += 1;
        _userBalances[newToken.user] += 1;
        _tokenCounter += 1;
    }
    }

    function update(uint256 _tokenId, Token_Struct calldata param) external manufacturerOnly override  {
        require (_owners[_tokenId] != address(0), "[TokenStorage] Such token does not exist.");
        require (param.car == _tokens[_tokenId].car, "[TokenStorage] Invalid: cannot change the device's address");

        Token_Struct memory target = _tokens[_tokenId];

        if (target.owner != param.owner) {
    unchecked {
            _ownerBalances[target.owner]--;
            _ownerBalances[param.owner]++;
    }
        }
        if (target.user != param.user) {
        unchecked {
            _userBalances[target.user]--;
            _userBalances[param.user]++;
        }
        }

        _tokens[_tokenId] = param;
    }

    function remove(uint256 _tokenId) external manufacturerOnly override {
        require (_owners[_tokenId] != address(0), "[TokenStorage] Such token does not exist.");

        Token_Struct memory target = _tokens[_tokenId];

    unchecked {
        _tokenCounter -= 1;
        _userBalances[target.user] -= 1;
        _ownerBalances[target.owner] -= 1;
    }
        delete _tokenIdOfCar[target.car];
        delete _ownerOfCar[target.car];
        delete _owners[_tokenId];
        delete _tokens[_tokenId];
    }
}

