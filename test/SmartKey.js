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

        describe("[mint]", function() {
            it ("revert minting when who is not the manufacturer try to mint", async function() {
                const { contract, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

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

        describe("[burn]", function() {
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
                const { contract, manufacturer, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);

                let tokenId = web3.utils.hexToNumberString(car.address);
                await expect(contract.connect(otherAccount)
                    .burnToken(tokenId))
                    .to.revertedWith("[SmartKey] Only owner can burn this token.")
            })

            it ("revert when trying to burn a token which does not exist", async function() {
                const { contract, owner } = await loadFixture(deploySmartKeyContract);

                let noExistTokenId = 0;
                await expect(contract.connect(owner)
                    .burnToken(noExistTokenId))
                    .to.revertedWith("[SmartKey] Such token does not exist.");
            })
        })

        describe("[transfer]", function() {
            it ("success to transfer a token", async function() {
                const { contract, manufacturer, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

                let tokenId = web3.utils.hexToNumberString(car.address);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                await contract.connect(car).ownerEngagement(0);

                expect(await contract.connect(owner)
                    .transferFrom(owner.address, otherAccount.address, tokenId))
                    .to.emit(contract, "Transfer").withArgs(
                        owner.address,
                        otherAccount.address,
                        tokenId)
            })

            it ("revert when the token is waiting for an owner", async function() {
                const { contract, manufacturer, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                await expect(contract.connect(owner)
                    .transferFrom(owner.address, otherAccount.address, tokenId))
                    .to.revertedWith("[SmartKey] Not transferable since the owner is not yet set.")
            })

            it ("revert when who is not allowed tries to transfer a token", async function() {
                const { contract, manufacturer, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                await expect(contract.connect(otherAccount)
                    .transferFrom(owner.address, otherAccount.address, tokenId))
                    .to.revertedWith("ERC721: caller is not token owner or approved")
            })
        })
    })
})