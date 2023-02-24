// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./IERC4519.sol";

interface TokenStorage {

    enum States { WaitingForOwner, EngagedWithOwner, WaitingForUser, EngagedWithUser }

    struct Token_Struct{
        address owner;                                      //Indicate who can transfer this token, 0 if no one
        address car;                                        //Indicate the BCA of the secure device associated to this token
        address user;                                       //Indicate who can use this secure device
        States state;                                       //If blocked (false) then token should be verified by new user or new owner
        uint256 hashK_OD;                                   //Hash of the Key shared between owner and device
        uint256 hashK_UD;                                   //Hash of the Key shared between user and device
        uint256 dataEngagement;                             //Public Key to create K_OD or K_UD depending on token state
        uint256 timestamp;                                  //Last time that device updated its proof of live
        uint256 timeout;                                    //timeout to verify a device error
    }

    function findById(uint256 _tokenId) external view virtual returns (Token_Struct memory);

    function findByCar(address _addressAsset) external view virtual returns (uint256);

    function getBalanceOfOwner(address _addressOwner) external view virtual returns (uint256);

    function getBalanceOfUser(address _addressUser) external view virtual returns (uint256);

    function getTotalCount() external view virtual returns (uint256);

    //@dev This function must be restricted only to whom have right authorities.
    function create(uint256 _tokenId, Token_Struct calldata newToken) external virtual;

    //@dev This function must be restricted only to whom have right authorities.
    function update(uint256 _tokenId, Token_Struct calldata param) external virtual;

    //@dev This function must be restricted only to whom have right authorities.
    function remove(uint256 _tokenId) external virtual;

    function transferAuthority(address newContract) external virtual;
}
