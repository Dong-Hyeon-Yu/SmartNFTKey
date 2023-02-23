const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");
const web3 = require("web3");


describe("TokenStorage", function () {

    const States = {
        WaitingForOwner: 0,
        EngagedWithOwner: 1,
        WaitingForUser: 2,
        EngagedWithUser: 3
    }

    async function deployContract() {

        // Contracts are deployed using the first signer/account by default
        const [manufacturer, car, owner, user, otherAccount] = await ethers.getSigners();

        const storageContract = await ethers.getContractFactory("TokenStorageImpl");
        const contract = await storageContract.deploy();
        await contract.connect(manufacturer).transferAuthority(manufacturer.address);

        return { contract, manufacturer, car, owner, user, otherAccount };
    }

    describe("[Empty storage]", function () {
        it('findById', async function () {
            const { contract, manufacturer, car } = await loadFixture(deployContract);

            const tokenId = web3.utils.hexToNumberString(car.address);
            const tx = await contract.connect(manufacturer).findById(tokenId);

            expect(tx.owner).to.equal("0x0000000000000000000000000000000000000000");
            expect(tx.car).to.equal("0x0000000000000000000000000000000000000000");
            expect(tx.user).to.equal("0x0000000000000000000000000000000000000000");
            expect(tx.state).to.equal(States.WaitingForOwner);
            expect(tx.hashK_OD).to.equal(0);
            expect(tx.hashK_UD).to.equal(0);
            expect(tx.dataEngagement).to.equal(0);
            expect(tx.timestamp).to.equal(0);
            expect(tx.timeout).to.equal(0);
        });

        it('findByCar', async function () {
            const { contract, manufacturer, car } = await loadFixture(deployContract);

            expect(await contract.connect(manufacturer).findByCar(car.address))
                .to.equal("0");
        });

        it('getBalanceOfOwner', async function () {
            const { contract, manufacturer, owner } = await loadFixture(deployContract);

            expect(await contract.connect(manufacturer).getBalanceOfOwner(owner.address))
                .to.equal("0");
        });

        it('getBalanceOfUser', async function () {
            const { contract, manufacturer, user } = await loadFixture(deployContract);

            expect(await contract.connect(manufacturer).getBalanceOfUser(user.address))
                .to.equal("0");
        });

        it('getTotalCount', async function () {
            const { contract, manufacturer } = await loadFixture(deployContract);

            expect(await contract.connect(manufacturer).getTotalCount())
                .to.equal("0");
        });

        it('update nothing', async function () {
            const { contract, manufacturer, car } = await loadFixture(deployContract);

            const tokenId = web3.utils.hexToNumberString(car.address);
            await expect(contract.connect(manufacturer)
                .update(tokenId, [
                    "0x0000000000000000000000000000000000000000",   //owner
                    "0x0000000000000000000000000000000000000000",   //car
                    "0x0000000000000000000000000000000000000000",   //user
                    States.WaitingForOwner,                         //state
                    0,                                              //hashK_OD
                    0,                                              //hashK_UD
                    0,                                              //dataEngagement
                    0,                                              //timestamp
                    0                                               //timeout
                ])).to.revertedWith("[TokenStorage] Such token does not exist.");
        });
    })

    describe("[Manufacturer only]", function () {
        it('"create" can be called by manufacturer only.', async function () {
            const { contract, car, otherAccount } = await loadFixture(deployContract);

            const tokenId = web3.utils.hexToNumberString(car.address);
            await expect(contract.connect(otherAccount)
                .create(tokenId, [
                    "0x0000000000000000000000000000000000000000",   //owner
                    "0x0000000000000000000000000000000000000000",   //car
                    "0x0000000000000000000000000000000000000000",   //user
                    States.WaitingForOwner,                         //state
                    0,                                              //hashK_OD
                    0,                                              //hashK_UD
                    0,                                              //dataEngagement
                    0,                                              //timestamp
                    0                                               //timeout
                ])).to.revertedWith("[TokenStorage] Access Denied.");
        });

        it('"update" can be called by manufacturer only.', async function () {
            const { contract, car, otherAccount } = await loadFixture(deployContract);

            const tokenId = web3.utils.hexToNumberString(car.address);
            await expect(contract.connect(otherAccount)
                .update(tokenId, [
                    "0x0000000000000000000000000000000000000000",   //owner
                    "0x0000000000000000000000000000000000000000",   //car
                    "0x0000000000000000000000000000000000000000",   //user
                    States.WaitingForOwner,                         //state
                    0,                                              //hashK_OD
                    0,                                              //hashK_UD
                    0,                                              //dataEngagement
                    0,                                              //timestamp
                    0                                               //timeout
                ])).to.revertedWith("[TokenStorage] Access Denied.");
        });

        it('"remove" can be called by manufacturer only.', async function () {
            const { contract, car, otherAccount } = await loadFixture(deployContract);

            const tokenId = web3.utils.hexToNumberString(car.address);
            await expect(contract.connect(otherAccount)
                .remove(tokenId))
                .to.revertedWith("[TokenStorage] Access Denied.");
        });
    })

    describe("[Integration Test]", function () {
        it('Integration Test', async function () {
            const { contract, manufacturer, car, owner, user, otherAccount } = await loadFixture(deployContract);

            /* 1.create new token */
            const tokenData1 = [owner.address, car.address, user.address, States.WaitingForOwner, 0, 0, 0, 0, 1000];
            const tokenId1 = web3.utils.hexToNumberString(car.address);
            expect(await contract.connect(manufacturer)
                .create(tokenId1, tokenData1))
                .to.ok;

            /* 2.prevent double-save for the same tokenId */
            await expect(contract.connect(manufacturer)
                .create(tokenId1, tokenData1))
                .to.revertedWith("[TokenStorage] TokenId already exists.");

            /* 3.find saved token by id */
            const tx = await contract.connect(manufacturer)
                .findById(tokenId1);
            expect(tx.owner).to.be.equal(owner.address);
            expect(tx.car).to.be.equal(car.address);
            expect(tx.user).to.be.equal(user.address);

            /* 4. find the tokenId by car address */
            expect(await contract.connect(manufacturer)
                .findByCar(car.address))
                .to.equal(tokenId1, "4. find the tokenId by car address");


            /* 7. get the balance of owner */
            expect(await contract.connect(manufacturer)
                .getBalanceOfOwner(owner.address))
                .to.equal(1, "7. get the balance of owner");

            /* 8. get empty balance */
            expect(await contract.connect(manufacturer)
                .getBalanceOfOwner(otherAccount.address))
                .to.equal(0, "8. get empty balance");

            /* 9. get the balance of user */
            expect(await contract.connect(manufacturer)
                .getBalanceOfUser(user.address))
                .to.equal(1, "9. get the balance of user");

            /* 10. get empty balance */
            expect(await contract.connect(manufacturer)
                .getBalanceOfUser(otherAccount.address))
                .to.equal(0, "10. get empty balance");

            /* 11. save another token */
            const tokenData2 = [owner.address, otherAccount.address, user.address, States.WaitingForOwner, 0, 0, 0, 0, 1000];
            const tokenId2 = web3.utils.hexToNumberString(otherAccount.address);
            expect(await contract.connect(manufacturer)
                .create(tokenId2, tokenData2))
                .to.ok;

            /* 12. total count */
            expect(await contract.connect(manufacturer)
                .getTotalCount())
                .to.equal(2, "12. total count");


            /* 13. get the balance of owner */
            expect(await contract.connect(manufacturer)
                .getBalanceOfOwner(owner.address))
                .to.equal(2, "13. get the balance of owner");

            /* 14. invalid update */
            let param = [owner.address, user.address, user.address, States.WaitingForOwner, 0, 0, 0, 0, 1000];
            await expect(contract.connect(manufacturer)
                .update(tokenId2, param))
                .to.revertedWith("[TokenStorage] Invalid: cannot change the device's address");

            /* 15. normal update */
            param = [owner.address, otherAccount.address, owner.address, States.WaitingForOwner, 0, 0, 0, 0, 1000];
            expect(await contract.connect(manufacturer)
                .update(tokenId2, param))
                .to.ok;

            /* 16. get user-balance of the 'owner' */
            expect(await contract.connect(manufacturer)
                .getBalanceOfUser(owner.address))
                .to.equal(1, "16. get user-balance of the 'owner'");

            /* 17. remove a token */
            expect(await contract.connect(manufacturer)
                .remove(tokenId2))
                .to.ok;

            /* 18. total count */
            expect(await contract.connect(manufacturer)
                .getTotalCount())
                .to.equal(1, "18. total count");

            /* 19. find removed token by car */
            expect(await contract.connect(manufacturer)
                .findByCar(otherAccount.address))
                .to.equal(0, "19. find removed token by car");
        });
    })
})