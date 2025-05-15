require('dotenv').config();
const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');

const source = fs.readFileSync('Gmonad.sol', 'utf8');

const input = {
    language: 'Solidity',
    sources: {
        'Gmonad.sol': {
            content: source,
        },
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode'],
            },
        },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const contractFile = output.contracts['Gmonad.sol']['Gmonad'];

const abi = contractFile.abi;
const bytecode = contractFile.evm.bytecode.object;

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    console.log("Deploying contract...");

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();

    console.log("Contract deployed at address:", contract.target);
}

main().catch((err) => {
    console.error("Deployment failed:", err);
});
