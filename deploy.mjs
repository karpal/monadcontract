import dotenv from 'dotenv';
import fs from 'fs';
import solc from 'solc';
import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import figlet from 'figlet';

dotenv.config();

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
    const userInput = await askUser(chalk.blueBright("🔢 Berapa jumlah kontrak yang ingin kamu buat? "));
    const totalContracts = parseInt(userInput);

    if (isNaN(totalContracts) || totalContracts <= 0) {
        console.error(chalk.red("❌ Input tidak valid. Masukkan angka lebih dari 0."));
        return;
    }

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    console.log(chalk.cyan(`\n🚀 Deploying ${totalContracts} contract(s) satu per satu...\n`));

    for (let i = 0; i < totalContracts; i++) {
        console.log(chalk.yellow(`🚧 Deploying contract #${i + 1}...`));

        const estimatedGas = await provider.estimateGas({
            from: wallet.address,
            data: "0x" + bytecode,
        });

        const gasPriceHex = await provider.send("eth_gasPrice", []);
        const gasPrice = BigInt(gasPriceHex);
        const estimatedCost = gasPrice * BigInt(estimatedGas);
        const ethCost = ethers.formatEther(estimatedCost);

        console.log(`   ⛽ Estimasi gas: ${chalk.magenta(estimatedGas)} @ ${chalk.magenta(ethers.formatUnits(gasPrice, "gwei"))} gwei`);
        console.log(`   💰 Estimasi biaya: ~${chalk.green(ethCost)} MON`);

        const contract = await factory.deploy();
        await contract.waitForDeployment();

        console.log(chalk.green(`✅ Contract #${i + 1} deployed at: ${contract.target}\n`));

        if (i < totalContracts - 1) {
            console.log(chalk.gray(`⏳ Menunggu ${DELAY_MS / 1000} detik sebelum deploy berikutnya...\n`));
            await delay(DELAY_MS);
        }
    }

    console.log(chalk.black.bgGreen("🎉 Semua kontrak berhasil dideploy!"));
}

figlet.text('karpal', { horizontalLayout: 'default' }, function (err, data) {
    if (err) {
        console.log('❌ Error saat menampilkan figlet:');
        console.dir(err);
        return;
    }
    console.log(chalk.green(data));
    main().catch((err) => {
        console.error(chalk.white.bgRed("❌ Deployment gagal:"), chalk.red(err));
    });
});
