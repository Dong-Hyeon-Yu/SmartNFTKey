const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require("web3");
const EC = require("elliptic").ec;

describe ("SmartKey", function() {

    const States = {
        WaitingForOwner: 0,
        EngagedWithOwner: 1,
        WaitingForUser: 2,
        EngagedWithUser: 3
    }

    async function deploySmartKeyContract() {

        // Contracts are deployed using the first signer/account by default
        const [manufacturer, car, owner, user, otherAccount] = await ethers.getSigners();

        const SmartKeyContract = await ethers.getContractFactory("SmartKey");
        const contract = await SmartKeyContract.deploy();

        return { contract, manufacturer, car, owner, user, otherAccount };
    }

    async function setupOwner(contract, owner, car, tokenId) {
        const ECDH = new EC('curve25519');
        const deviceKeypair = ECDH.genKeyPair();
        const ownerKeypair = ECDH.genKeyPair();

        const ownerSharedKey = ownerKeypair.derive(deviceKeypair.getPublic());
        const hash_K_OA = web3.utils.keccak256(ownerSharedKey);
        await contract.connect(owner)
            .startOwnerEngagement(
                tokenId,
                web3.utils.hexToNumberString(`0x${ownerKeypair.getPublic().encode('hex')}`),
                web3.utils.hexToNumberString(hash_K_OA));


        const deviceSharedKey = deviceKeypair.derive(ownerKeypair.getPublic());
        const hash_K_A = web3.utils.keccak256(deviceSharedKey);

        expect(await contract.connect(car)
            .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
            .to.emit(contract, "OwnerEngaged").withArgs(tokenId);
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
                await setupOwner(contract, owner, car, tokenId);

                await expect(await contract.connect(owner)
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

    describe("ERC4519", function() {
        describe("[Owner Engagement]", async function() {
            it ("engagement only can be triggered with the preset owner", async function() {
                const { contract, manufacturer, car, owner, otherAccount } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                await expect(contract.connect(otherAccount)
                    .startOwnerEngagement(tokenId, 0, 0))
                    .revertedWith("[SmartKey] Access denied: Owner can call this function only.");
            })

            it ("success to engage with owner", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                const ECDH = new EC('curve25519');
                const deviceKeypair = ECDH.genKeyPair();
                const ownerKeypair = ECDH.genKeyPair();

                const ownerSharedKey = ownerKeypair.derive(deviceKeypair.getPublic());
                const hash_K_OA = web3.utils.keccak256(ownerSharedKey);
                await contract.connect(owner)
                    .startOwnerEngagement(
                        tokenId,
                        web3.utils.hexToNumberString(`0x${ownerKeypair.getPublic().encode('hex')}`),
                        web3.utils.hexToNumberString(hash_K_OA));


                const deviceSharedKey = deviceKeypair.derive(ownerKeypair.getPublic());
                const hash_K_A = web3.utils.keccak256(deviceSharedKey);

                await expect(await contract.connect(car)
                    .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.emit(contract, "OwnerEngaged").withArgs(tokenId);

                const tx = await contract.connect(owner).getToken(tokenId);
                expect(tx.state).be.equal(States.EngagedWithOwner);
                expect(tx.user).be.equal("0x0000000000000000000000000000000000000000");
                expect(tx.dataEngagement).be.equal(0);
            })

            it ("Invalid ECDH session key", async function () {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                const ECDH = new EC('curve25519');
                const deviceKeypair = ECDH.genKeyPair();
                const ownerKeypair = ECDH.genKeyPair();
                const otherKeypair = ECDH.genKeyPair();

                const corruptedSharedKey = otherKeypair.derive(deviceKeypair.getPublic());
                const corruptedHash_K_OA = web3.utils.keccak256(corruptedSharedKey);
                await contract.connect(owner)
                    .startOwnerEngagement(
                        tokenId,
                        web3.utils.hexToNumberString(`0x${ownerKeypair.getPublic().encode('hex')}`),
                        web3.utils.hexToNumberString(corruptedHash_K_OA));

                const deviceSharedKey = deviceKeypair.derive(ownerKeypair.getPublic());
                const hash_K_A = web3.utils.keccak256(deviceSharedKey);
                await expect(contract.connect(car)
                    .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.revertedWith("[SmartNFT] ECDH setup fail.");
            })

            it ("Unregistered device call this function legally", async function() {
                const { contract, car } = await loadFixture(deploySmartKeyContract);

                const hash_K_A = 1234;
                await expect(contract.connect(car)
                    .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.revertedWith("[SmartKey] Unregistered device.");
            })

            it ("Owner haven't set own sessionKey yet.", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);

                const ECDH = new EC('curve25519');
                const deviceKeypair = ECDH.genKeyPair();
                const ownerKeypair = ECDH.genKeyPair();

                const deviceSharedKey = deviceKeypair.derive(ownerKeypair.getPublic());
                const hash_K_A = web3.utils.keccak256(deviceSharedKey);

                await expect(contract.connect(car)
                    .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.revertedWith("[SmartNFT] Owner has not started to setup yet.");
            })

            it ("Re-issue the owner's session key", async function() {
                const { contract, manufacturer, car, owner } = await loadFixture(deploySmartKeyContract);

                await contract.connect(manufacturer).createToken(car.address, owner.address);
                const tokenId = web3.utils.hexToNumberString(car.address);
                await setupOwner(contract, owner, car, tokenId);

                let tx = await contract.connect(owner).getToken(tokenId);
                const oldHash = tx.hashK_OD;

                await setupOwner(contract, owner, car, tokenId);
                tx = await contract.connect(owner).getToken(tokenId);
                const newHash = tx.hashK_OD;

                expect(newHash).to.not.equal(oldHash);
            })
        })

    })
})