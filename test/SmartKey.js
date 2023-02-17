const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require("web3");

describe ("SmartKey", function() {

    async function deploySmartKeyContract() {

        // Contracts are deployed using the first signer/account by default
        const [manufacturer, car, owner, user, otherAccount] = await ethers.getSigners();

        const SmartKeyContract = await ethers.getContractFactory("SmartKey");
        const contract = await SmartKeyContract.deploy();

        return { contract, manufacturer, car, owner, user, otherAccount };
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

    describe("ERC721", function () {

        it (`_name is "SmartNFTKey"`, async function() {
            const {contract} = await loadFixture(deploySmartKeyContract)
            expect(await contract.name()).to.equal("SmartNFTKey")
        })

        it (`_symbol is "SNK"`, async function() {
            const {contract} = await loadFixture(deploySmartKeyContract)
            expect(await contract.symbol()).to.equal("SNK")
        })

        describe("[minting]", function() {
            it ("revert minting when who is not the manufacturer try to mint", async function() {
                const { contract, _, car, owner, __, otherAccount } = await loadFixture(deploySmartKeyContract);

                await expect(contract.connect(otherAccount)
                    .createToken(car.address, owner.address))
                    .to.be.revertedWith("[SmartKey] Only the manufacturer can create new tokens.");
            })

            it ("success to mint a token by the manufacturer", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                let newTokenId = web3.utils.hexToNumberString(car.address);

                await expect(contract.connect(manufacturer)
                    .createToken(car.address, owner.address))
                    .to.emit(contract, "Transfer").withArgs(
                        "0x0000000000000000000000000000000000000000", // from
                            owner.address,  // to
                            newTokenId  // tokenId
                        );

                expect(await contract.ownerOf(newTokenId)).equal(owner.address);
                expect(await contract.balanceOf(owner.address)).equal(1);
            })

            it ("duplicated minting is not allowed", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);

                await expect(contract.connect(manufacturer)
                    .createToken(car.address, owner.address))
                    .to.revertedWith("[SmartKey] Duplicated minting is not allowed!");
            })
        })

        describe("[burning]", function() {
            it("success to burn a token by the owner", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);

                let tokenId = web3.utils.hexToNumberString(car.address);
                await expect(contract.connect(owner)
                    .burnToken(tokenId))
                    .to.emit(contract, "Transfer")
                    .withArgs(
                        owner.address,  // from
                        "0x0000000000000000000000000000000000000000", // to
                        tokenId);
                await expect(contract.ownerOf(tokenId))
                    .to.revertedWith("ERC721: invalid token ID")
            })

            it ("only owner can burn the token", async function() {
                const { contract, manufacturer, car, owner, _, otherAccount } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);

                let tokenId = web3.utils.hexToNumberString(car.address);
                await expect(contract.connect(otherAccount)
                    .burnToken(tokenId))
                    .to.revertedWith("[SmartKey] Only owner can burn this token.")
            })

            it ("revert when trying to burn a token which does not exist", async function() {
                const { contract, _, __, owner } = await loadFixture(deploySmartKeyContract);

                let noExistTokenId = 0;
                await expect(contract.connect(owner)
                    .burnToken(noExistTokenId))
                    .to.revertedWith("[SmartKey] Such token does not exist.");
            })
        })
    })
})