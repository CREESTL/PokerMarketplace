/**
 *
 * This script is used to deploy contracts to remote testnet or mainnet
 * It uses real token addresses from these networks
 *
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
const { parseUnits, parseEther } = ethers.utils;

// Check that one of two allowed networks was provided
if (network.name != "donau" && network.name != "bttc") {
  throw "Please run deployment script with `--network donau` or `--network mainnet` flags!";
}

// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./deployOutputRemote.json");

// List of default supported tokens differs depending on the chain of deployment
let all_tokens = require("./supportedTokensRemote.json");
let SUPPORTED_TOKENS;
if (network.name == "donau") {
  SUPPORTED_TOKENS = all_tokens.donau;
} else if (network.name == "bttc") {
  SUPPORTED_TOKENS = all_tokens.bttc;
}

const oneDay = 86400;
const tenDays = 864000;

// One BP 0.0001
// One percent is 0.01
// One percent in BP is 100BP
const onePercent = 100;

// Creates a number of random wallets to be used while deploying contracts
function createWallets(numberWallets) {
  let createdWallets = [];
  for (let i = 0; i < numberWallets; i++) {
    let wallet = ethers.Wallet.createRandom();
    createdWallets.push(wallet);
    console.log(`New wallet №${i + 1}:`);
    console.log(`    Address: ${wallet.address}`);
    console.log(`    Private key: ${wallet.privateKey}`);
  }
  return createdWallets;
}

// Create 2 new wallets
// Use them in NFTSale and NFTMarketplace as fee receivers
let [nftSaleFeeReceiver, nftMarketplaceFeeReceiver] = createWallets(2);

let contractName;
let card;
let cardFactory;
let cardRandomMinter;
let nftMarketplace;
let nftSale;

async function main() {

  [ownerAcc, clientAcc1, clientAcc2] = await ethers.getSigners();

  // Contract #1: Card
  contractName = "Card";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  contractDeployTx = await _contractProto.deploy();
  card = await contractDeployTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY.networks[network.name][contractName].address = card.address;

  // Contract #2: Card Factory
  contractName = "CardFactory";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  // Provide the factory with card address.
  contractDeployTx = await _contractProto.deploy(card.address);
  cardFactory = await contractDeployTx.deployed();

  await card.setMinterRole(cardFactory.address, true);
  await cardFactory.setIdBoundaryForOption(0, 0, 6500);
  await cardFactory.setIdBoundaryForOption(1, 6500, 7271);
  await cardFactory.setIdBoundaryForOption(2, 7271, 7771);
  await cardFactory.setIdBoundaryForOption(3, 7771, 7796);
  await cardFactory.setIdBoundaryForOption(4, 7796, 7803);

  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY.networks[network.name][contractName].address =
    cardFactory.address;

  // Contract #3: Card Random Minter
  contractName = "CardRandomMinter";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  // Provide the game controller with factory address
  contractDeployTx = await _contractProto.deploy(cardFactory.address);
  cardRandomMinter = await contractDeployTx.deployed();
  await cardFactory.setMinterRole(cardRandomMinter.address, true);
  // Add owner to admins
  await cardRandomMinter.addAdmin(ownerAcc.address);
  // Read supported addresses from the JSON file and add them to the minter
  for (let [token, info] of Object.entries(SUPPORTED_TOKENS)) {
    let [address, price] = Object.values(info);
    await cardRandomMinter.addSupportedToken(address);
    await delay(5000);
    // `price` in JSON file is without `decimals`, so we have to multiply it by `decimals` using `parseEther`
    await cardRandomMinter.setMintPrice(address, parseEther(price.toString()));
  }
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY.networks[network.name][contractName].address =
    cardRandomMinter.address;

  // Contract #4: NFT Sale
  contractName = "NFTSale";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  contractDeployTx = await _contractProto.deploy(
    card.address,
    nftSaleFeeReceiver.address,
    oneDay,
    tenDays,
    onePercent
  );
  nftSale = await contractDeployTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY.networks[network.name][contractName].address = nftSale.address;
  OUTPUT_DEPLOY.networks[network.name][contractName].feeReceiverAddress =
    nftSaleFeeReceiver.address;
  OUTPUT_DEPLOY.networks[network.name][contractName].feeReceiverPrivateKey =
    nftSaleFeeReceiver.privateKey;

  // Contract #5: NFT Marketplace
  contractName = "NFTMarketplace";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);

  contractDeployTx = await _contractProto.deploy(
    card.address,
    nftMarketplaceFeeReceiver.address,
    oneDay,
    tenDays,
    onePercent
  );
  nftMarketplace = await contractDeployTx.deployed();
  console.log(`[${contractName}]: Deployment Finished!`);
  OUTPUT_DEPLOY.networks[network.name][contractName].address =
    nftMarketplace.address;
  OUTPUT_DEPLOY.networks[network.name][contractName].feeReceiverAddress =
    nftMarketplaceFeeReceiver.address;
  OUTPUT_DEPLOY.networks[network.name][contractName].feeReceiverPrivateKey =
    nftMarketplaceFeeReceiver.privateKey;

  console.log(
    `\n***Deployment is finished!***\nSee Results in "${
      __dirname + "/deployOutputRemote.json"
    }" File`
  );

  fs.writeFileSync(
    path.resolve(__dirname, "./deployOutputRemote.json"),
    JSON.stringify(OUTPUT_DEPLOY, null, "  ")
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
