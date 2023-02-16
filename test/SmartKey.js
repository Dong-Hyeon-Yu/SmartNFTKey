const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const {ethers} = require("hardhat");

describe ("SmartKey", function() {

    async function deploySmartKeyContract() {

        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        const SmartKeyContract = await ethers.getContractFactory("SmartKey");
        const contract = await SmartKeyContract.deploy("SmartNFT", "ST");

        return { contract, owner, otherAccount };
    }

    describe("ERC165", function () {

        it ("support ERC-165", async function() {
            const {contract} = await loadFixture(deploySmartKeyContract)
            expect(await contract.supportsInterface(0x01ffc9a7)).to.equal(true)
        })

        it ("support ERC-721", async function() {
            const {contract} = await loadFixture(deploySmartKeyContract)
            expect(await contract.supportsInterface(0x80ac58cd)).to.equal(true)
        })

        it ("support ERC-4519", async function() {
            const {contract} = await loadFixture(deploySmartKeyContract)
            expect(await contract.supportsInterface(0x8a68abe3)).to.equal(true)
        })
    })
})