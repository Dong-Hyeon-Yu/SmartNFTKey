const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require("web3");
const EC = require("elliptic").ec;


describe ("SmartKey", () => {

    let contract;
    let tokenId;
    let manufacturer, owner, car, user, otherAccount;

    const States = {
        WaitingForOwner: 0,
        EngagedWithOwner: 1,
        WaitingForUser: 2,
        EngagedWithUser: 3
    }

    async function setup() {
        let [_m, _o, _c, _u, _oa] =  await ethers.getSigners()
        tokenId = web3.utils.hexToNumberString(_c.address)

        const tokenStorage = await ethers.getContractFactory("TokenStorageImpl");
        const tokenStorage_ = await tokenStorage.deploy();

        const SmartKeyContract = await ethers.getContractFactory("SmartKey");
        const _contract = await SmartKeyContract.deploy(tokenStorage_.address);

        await tokenStorage_.transferAuthority(_contract.address);



        return [_contract, _m,  _o, _c, _u, _oa];
    }

    beforeEach(async () => {
        [contract, manufacturer, owner, car, user, otherAccount] = await loadFixture(setup);
    })

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

        await expect(contract.connect(car)
            .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
            .to.emit(contract, "OwnerEngaged").withArgs(tokenId);
    }

    describe("ERC165", function () {

        it ("support ERC-165", async function() {
            expect(await contract.supportsInterface(0x01ffc9a7)).to.equal(true)
        })

        it ("support ERC-721", async function() {
            expect(await contract.supportsInterface(0x80ac58cd)).to.equal(true)
        })

        it ("support ERC-4519", async function() {
            expect(await contract.supportsInterface(0x8a68abe3)).to.equal(true)
        })
    })

    describe("ERC721", function () {

        it (`_name is "SmartNFTKey"`, async function() {
            expect(await contract.name()).to.equal("SmartNFTKey")
        })

        it (`_symbol is "SNK"`, async function() {
            expect(await contract.symbol()).to.equal("SNK")
        })

        describe("[mint]", function() {
            it ("revert minting when who is not the manufacturer try to mint", async function() {

                await expect(contract.connect(otherAccount)
                    .safeMint(car.address, owner.address))
                    .to.be.revertedWith("[SmartKey] Only the manufacturer can create new tokens.");
            })

            it ("success to mint a token by the manufacturer", async function() {

                await expect(contract.connect(manufacturer)
                    .safeMint(car.address, owner.address))
                    .to.emit(contract, "Transfer").withArgs(
                        "0x0000000000000000000000000000000000000000", // from
                            owner.address,  // to
                            tokenId  // tokenId
                        );

                expect(await contract.ownerOf(tokenId)).equal(owner.address);
                expect(await contract.balanceOf(owner.address)).equal(1);
            })

            it ("duplicated minting is not allowed", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await expect(contract.connect(manufacturer)
                    .safeMint(car.address, owner.address))
                    .to.revertedWith("ERC721: token already minted");
            })
        })

        describe("[burn]", function() {
            it("success to burn a token by the owner", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await expect(contract.connect(owner)
                    .burn(tokenId))
                    .to.emit(contract, "Transfer")
                    .withArgs(
                        owner.address,  // from
                        "0x0000000000000000000000000000000000000000", // to
                        tokenId);
                await expect(contract.ownerOf(tokenId))
                    .to.revertedWith("ERC721: invalid token ID")
            })

            it ("only owner can burn the token", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await expect(contract.connect(otherAccount)
                    .burn(tokenId))
                    .to.revertedWith("ERC721: burn from incorrect owner")
            })

            it ("revert when trying to burn a token which does not exist", async function() {

                let noExistTokenId = 0;
                await expect(contract.connect(owner)
                    .burn(noExistTokenId))
                    .to.revertedWith("ERC721: invalid token ID");
            })
        })
        
        describe("[transfer]", function() {
            it ("success to transfer a token", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                await setupOwner(contract, owner, car, tokenId);

                await expect(contract.connect(owner)
                    .transferFrom(owner.address, otherAccount.address, tokenId))
                    .to.emit(contract, "Transfer").withArgs(
                        owner.address,
                        otherAccount.address,
                        tokenId)
            })

            it ("revert when the token is waiting for an owner", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                let tokenId = web3.utils.hexToNumberString(car.address);

                await expect(contract.connect(owner)
                    .transferFrom(owner.address, otherAccount.address, tokenId))
                    .to.revertedWith("[SmartKey] Token can't be transferred in \"WaitingForOwner\" mode")
            })

            it ("revert when who is not allowed tries to transfer a token", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);
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

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await expect(contract.connect(otherAccount)
                    .startOwnerEngagement(tokenId, 0, 0))
                    .revertedWith("[SmartKey] Access denied: Only the owner can call this function.");
            })

            it ("success to engage with owner", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await setupOwner(contract, owner, car, tokenId);

                const tx = await contract.connect(owner).getById(tokenId);
                expect(tx.state).be.equal(States.EngagedWithOwner);
                expect(tx.user).be.equal("0x0000000000000000000000000000000000000000");
                expect(tx.dataEngagement).be.equal(0);
            })

            it ("Invalid ECDH session key", async function () {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

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

                const hash_K_A = 1234;
                await expect(contract.connect(car)
                    .ownerEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.revertedWith("[SmartKey] Unregistered device.");
            })

            it ("Owner haven't set own sessionKey yet.", async function() {

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

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

                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await setupOwner(contract, owner, car, tokenId);

                let tx = await contract.connect(owner).getById(tokenId);
                const oldHash = tx.hashK_OD;

                await setupOwner(contract, owner, car, tokenId);
                tx = await contract.connect(owner).getById(tokenId);
                const newHash = tx.hashK_OD;

                expect(newHash).to.not.equal(oldHash);
            })
        })

        describe("[User Engagement]", () => {

            async function setupOwnerAsUser(contract, owner, car, tokenId) {
                await expect(contract.connect(owner)
                    .setUser(tokenId, owner.address))
                    .to.emit(contract, "UserEngaged").withArgs(tokenId);
                const tx = await contract.getById(tokenId);
                expect(tx.state).to.equal(States.EngagedWithUser);
            }

            async function setupUser(contract, owner, car, user, tokenId) {

                await expect(contract.connect(owner)
                    .setUser(tokenId, user.address))
                    .to.emit(contract, "UserAssigned").withArgs(tokenId, user.address);
                const tx = await contract.getById(tokenId);
                expect(tx.state).to.equal(States.WaitingForUser);

                const ECDH = new EC('curve25519');
                const deviceKeypair = ECDH.genKeyPair();
                const userKeypair = ECDH.genKeyPair();

                const userSharedKey = userKeypair.derive(deviceKeypair.getPublic());
                const hash_K_UA = web3.utils.keccak256(userSharedKey);
                await contract.connect(user)
                    .startUserEngagement(
                        tokenId,
                        web3.utils.hexToNumberString(`0x${userKeypair.getPublic().encode('hex')}`),
                        web3.utils.hexToNumberString(hash_K_UA));

                const deviceSharedKey = deviceKeypair.derive(userKeypair.getPublic());
                const hash_K_A = web3.utils.keccak256(deviceSharedKey);

                await expect(contract.connect(car)
                    .userEngagement(web3.utils.hexToNumberString(hash_K_A)))
                    .to.emit(contract, "UserEngaged").withArgs(tokenId);
            }

            it('revert, Only the owner can call this function', async () => {
                //given
                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                await setupOwner(contract, owner, car, tokenId);

                //when-then
                await expect(contract.connect(otherAccount)
                    .setUser(tokenId, user.address))
                    .to.revertedWith("[SmartKey] Access denied: Only the owner can call this function.")
            });

            it('revert, the owner have not yet set', async () => {
                await contract.connect(manufacturer).safeMint(car.address, owner.address);

                await expect(contract.connect(owner)
                    .setUser(tokenId, user.address))
                    .to.revertedWith("[SmartKey] Cannot set user while waiting for new owner.")
            });

            it('revert, an invalid user tries to engage', async () => {
                //given
                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                await setupOwner(contract, owner, car, tokenId);
                await contract.connect(owner).setUser(tokenId, user.address);

                //when-then
                await expect(contract.connect(otherAccount)
                    .startUserEngagement(tokenId, 1234235, 1234134))
                    .to.revertedWith("[SmartKey] invalid user.")
            });

            it('revert, the user have not yet set', async () => {
                //given
                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                await setupOwner(contract, owner, car, tokenId);

                //when-then
                await expect(contract.connect(car)
                    .userEngagement(1242352))
                    .to.revertedWith("[SmartKey] No user having been engaged.")
            });

            it('success to engage with a new user', async () => {
                //given
                await contract.connect(manufacturer).safeMint(car.address, owner.address);
                await setupOwner(contract, owner, car, tokenId);

                //when
                await setupUser(contract, owner, car, user, tokenId);

                //then
                const tx = await contract.getById(tokenId);
                expect(tx.state).to.equal(States.EngagedWithUser);
                expect(tx.user).to.equal(user.address);
            });

            describe("administrator mode by setting the user as null", () => {
                const nullAddress = "0x0000000000000000000000000000000000000000";

                it('set "EngagedWithOwner" from "WaitingForUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await contract.connect(owner).setUser(tokenId, user.address);

                    //when
                    await expect(contract.connect(owner)
                        .setUser(tokenId, nullAddress))
                        .to.emit(contract, "OwnerEngaged").withArgs(tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithOwner);
                    expect(tx.user).to.equal(nullAddress);
                });

                it('set "EngagedWithOwner" from "EngagedWithUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await setupUser(contract, owner, car, user, tokenId);

                    //when
                    await expect(contract.connect(owner)
                        .setUser(tokenId, nullAddress))
                        .to.emit(contract, "OwnerEngaged").withArgs(tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithOwner);
                    expect(tx.user).to.equal(nullAddress);
                });

                it('revert when try setting "EngagedWithOwner" from "EngagedWithOwner"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);

                    //when-then
                    await expect(contract.connect(owner)
                        .setUser(tokenId, nullAddress))
                        .to.revertedWith(
                            "[SmartNFT] Redundant call. The result will not have any effect to the state of this contract.");
                })
            })

            describe("owner-use mode by setting the owner as user", () => {
                it('set "EngagedWithUser" from "EngagedWithOwner"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    let tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithOwner);

                    //when
                    await setupOwnerAsUser(contract, owner, car, tokenId);

                    //then
                    tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(owner.address);
                });

                it('set "EngagedWithUser" from "EngagedWithUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await setupUser(contract, owner, car, user, tokenId);
                    let tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);

                    //when
                    await setupOwnerAsUser(contract, owner, car, tokenId);

                    //then
                    tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(owner.address);
                });

                it('set "EngagedWithUser" from "WaitingForUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await contract.connect(owner).setUser(tokenId, user.address)
                    let tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.WaitingForUser);

                    //when
                    await setupOwnerAsUser(contract, owner, car, tokenId);

                    //then
                    tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(owner.address);
                });
            })

            describe("user-use mode by setting the user as another person", () => {
                it('set "EngagedWithUser" from "EngagedWithOwner"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);

                    //when
                    await setupUser(contract, owner, car, user, tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(user.address);
                });

                it('set "EngagedWithUser" from "EngagedWithUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await setupUser(contract, owner, car, user, tokenId);

                    //when
                    await setupUser(contract, owner, car, otherAccount, tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(otherAccount.address);
                });

                it('set "EngagedWithUser" from "WaitingForUser"', async () => {
                    //given
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await contract.connect(owner).setUser(tokenId, user.address)

                    //when
                    await setupUser(contract, owner, car, user, tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                    expect(tx.user).to.equal(user.address);
                });
            })

            describe("light-weighted registration", () => {

                async function setUp() {
                    await contract.connect(manufacturer).safeMint(car.address, owner.address);
                    await setupOwner(contract, owner, car, tokenId);
                    await expect(contract.connect(owner)
                        .setUser(tokenId, user.address))
                        .to.emit(contract, "UserAssigned").withArgs(tokenId, user.address);
                }

                it('successfully authenticate and register a user', async () => {
                    //given : create NFT and set owner and then assign new user
                    await setUp();

                    //when : car conducts authentication process on behalf of the user.
                    const nonce = web3.utils.hexToNumberString(web3.utils.randomHex(32));
                    const requestType = web3.utils.hexToNumberString(0x01);
                    const timestamp = web3.utils.hexToNumberString(web3.utils.fromDecimal(Math.floor(Date.now() / 1000)));
                    const messageHash = web3.utils.keccak256(web3.utils.encodePacked(requestType, timestamp, nonce));
                    const signature = await user.signMessage(ethers.utils.arrayify(messageHash));

                    await expect(contract.connect(car).delegateUserEngagement(requestType, timestamp, nonce, signature))
                        .to.emit(contract, "UserEngaged")
                        .withArgs(tokenId);

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.EngagedWithUser);
                });

                it('revert, invalid signature', async () => {
                    //given : create NFT and set owner and then assign new user
                    await setUp();

                    //when : car conducts authentication process on behalf of the user.
                    const nonce = web3.utils.hexToNumberString(web3.utils.randomHex(32));
                    const requestType = web3.utils.hexToNumberString(0x01);
                    const timestamp = web3.utils.hexToNumberString(web3.utils.fromDecimal(Math.floor(Date.now() / 1000)));
                    const invalidSignature = "0x0123456789012345678901234567890123456789012345678901234567890123012345678901234567890123456789012345678901234567890123456789012345";
                    await expect(contract.connect(car)
                        .delegateUserEngagement(requestType, timestamp, nonce, invalidSignature))
                        .to.revertedWith("[SmartKey] Signature is not matched to the user.")

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.WaitingForUser);
                });

                it('revert, not assigned user', async () => {
                    //given : create NFT and set owner and then assign new user
                    await setUp();

                    //when : car conducts authentication process on behalf of the user.
                    const nonce = web3.utils.hexToNumberString(web3.utils.randomHex(32));
                    const requestType = web3.utils.hexToNumberString(0x01);
                    const timestamp = web3.utils.hexToNumberString(web3.utils.fromDecimal(Math.floor(Date.now() / 1000)));
                    const messageHash = web3.utils.keccak256(web3.utils.encodePacked(requestType, timestamp, nonce));
                    const otherUserSignature = await otherAccount.signMessage(ethers.utils.arrayify(messageHash));

                    await expect(contract.connect(car)
                        .delegateUserEngagement(requestType, timestamp, nonce, otherUserSignature))
                        .to.revertedWith("[SmartKey] Signature is not matched to the user.")

                    //then
                    const tx = await contract.getById(tokenId);
                    expect(tx.state).to.equal(States.WaitingForUser);
                });
            })
        })

    })
})