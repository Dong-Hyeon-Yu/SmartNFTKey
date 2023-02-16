// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IERC4519.sol";

contract SmartKey /*is IERC721, IERC4519*/ {

    enum States { waitingForOwner, engagedWithOwner, waitingForUser, engagedWithUser }

    address manufacturer;                                   //Address of manufacturer and owner of Smart Contract
    uint256 tokenCounter;                                   //To give a genuine tokenID based on the number of tokens created
    mapping(uint256 => address) ownerOfSD;                  //To khow who is the owner of a specific owner
    mapping(address => uint256) tokenIDOfBCA;               //To khow which is the tokenID associated to a secure device
    mapping(address => uint256) ownerBalance;               //To know how many tokens an owner has
    mapping(address => uint256) userBalance;                //To know how many tokens a user can use

    struct Token_Struct{
        address approved;                                   //Indicate who can transfer this token, 0 if no one
        address SD;                                         //Indicate the BCA of the secure device associated to this token
        address user;                                       //Indicate who can use this secure device
        States state;                                       //If blocked (false) then token should be verified by new user or new owner
        uint256 hashK_OD;                                   //Hash of the Key shared between owner and device
        uint256 hashK_UD;                                   //Hash of the Key shared between user and device
        uint256 dataEngagement;                             //Public Key to create K_OD or K_UD depending on token state
        uint256 timestamp;                                  //Last time that device updated its proof of live
        uint256 timeout;                                    //timeout to verify a device error
    }

    Token_Struct[] Tokens;

    constructor() {
        manufacturer = msg.sender;
        tokenCounter = 0;
    }

    /* ERC165 */
    function supportsInterface(bytes4 interfaceId) external view
    returns (bool) {
        return
        interfaceId == type(IERC165).interfaceId
        || interfaceId == type(IERC721).interfaceId
        || interfaceId == type(IERC4519).interfaceId;
    }


//    function setUser(uint256 _tokenId, address _addressUser) external override payable;
//
//
//    function startOwnerEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_OA) external override payable;
//
//
//    function ownerEngagement(uint256 _hashK_A) external override payable;
//
//
//    function startUserEngagement(uint256 _tokenId, uint256 _dataEngagement, uint256 _hashK_UA) external override payable;
//
//
//    function userEngagement(uint256 _hashK_A) external override payable;
//
//
//    function checkTimeout(uint256 _tokenId) external override
//    returns (bool);
//
//
//    function setTimeout(uint256 _tokenId, uint256 _timeout) external override;
//
//
//    function updateTimestamp() external override;
//
//
//    function tokenFromBCA(address _addressAsset) external view override
//    returns (uint256);
//
//
//    function ownerOfFromBCA(address _addressAsset) external view override
//    returns (address);
//
//
//    function userOf(uint256 _tokenId) external view override
//    returns (address);
//
//
//    function userOfFromBCA(address _addressAsset) external view override
//    returns (address);
//
//
//    function userBalanceOf(address _addressUser) external view override
//    returns (uint256);
//
//
//    function userBalanceOfAnOwner(address _addressUser, address _addressOwner) external view override
//    returns (uint256);
}