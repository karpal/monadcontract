require('dotenv').config();
const fs = require('fs');
const solc = require('solc');
const { ethers } = require('ethers');
const readline = require('readline');

const DELAY_MS = 5000; // Delay antar deploy (ms)

// Compile Solidity
const source = fs.readFileSync('Gmonad.sol', 'utf8');
const input = {
    language: 'Solidity',
    sources: {
        'Gmonad.sol': { content: source },
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

// Fungsi tanya terminal
function askUser(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(question, answer => {
        rl.close();
        resolve(answer);
    }));
}

// Delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const userInput = await askUser("🔢 Berapa jumlah kontrak yang ingin kamu deploy? ");
    const totalContracts = parseInt(userInput);

    if (isNaN(totalContracts) || totalContracts <= 0) {
        console.error("❌ Input tidak valid. Masukkan angka lebih dari 0.");
        return;
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log(`\n🚀 Deploying ${totalContracts} contract(s) one by one...\n`);

    for (let i = 0; i < totalContracts; i++) {
        console.log(`🚧 Deploying contract #${i + 1}...`);

        // Estimasi gas
        const estimatedGas = await provider.estimateGas({
            from: wallet.address,
            data: "0x" + bytecode,
        });

        const gasPriceHex = await provider.send("eth_gasPrice", []);
        const gasPrice = BigInt(gasPriceHex);
        const estimatedCost = gasPrice * BigInt(estimatedGas);

        const ethCost = ethers.formatEther(estimatedCost);

        console.log(`   ⛽ Estimasi gas: ${estimatedGas} @ ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
        console.log(`   💰 Estimasi biaya: ~${ethCost} ETH`);

        const contract = await factory.deploy();
        await contract.waitForDeployment();

        console.log(`✅ Contract #${i + 1} deployed at: ${contract.target}\n`);

        if (i < totalContracts - 1) {
            console.log(`⏳ Menunggu ${DELAY_MS / 1000} detik sebelum deploy berikutnya...\n`);
            await delay(DELAY_MS);
        }
    }

    console.log("🎉 Semua kontrak berhasil dideploy!");
}

main().catch((err) => {
    console.error("❌ Deployment gagal:", err);
});
