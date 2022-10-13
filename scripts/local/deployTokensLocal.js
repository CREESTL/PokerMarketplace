// SPDX-License-Identifier: MIT 

/**
 * 
 * This scripts is used to deploy token contracts on local Hardhat network to imitate these tokens
 * in remote testnet or mainnet.
 * 
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const delay = require("delay");
const { parseUnits, parseEther } = ethers.utils;

// JSON file to keep information about previous deployments
const OUTPUT_DEPLOY = require("./supportedTokensLocal.json");
const NUM_TOKENS = 5;

async function main() {

  if (network.name != "hardhat") {
    throw "Network must be `hardhat`!";
  }

  // Contract #1: Card
  contractName = "Rummy";
  console.log(`[${contractName}]: Start of Deployment...`);
  _contractProto = await ethers.getContractFactory(contractName);
  for (let i = 0; i < NUM_TOKENS; i++) {
    console.log(`Deploying token №${i}...`)
    let deployment = await _contractProto.deploy();
    let token = await deployment.deployed();
    console.log(`Token's address is: ${token.address}`);
    OUTPUT_DEPLOY[i + 1].address = token.address;
  }

  console.log(`\n***Deployment is finished!***\nSee Results in "${__dirname + '/supportedTokensLocal.json'}" File`);

  fs.writeFileSync(
    path.resolve(__dirname, "./supportedTokensLocal.json"),
    JSON.stringify(OUTPUT_DEPLOY, null, "  ")
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });