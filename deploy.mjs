import dotenv from 'dotenv';
import fs from 'fs';
import solc from 'solc';
import { ethers } from 'ethers';
import readline from 'readline';
import chalk from 'chalk';
import figlet from 'figlet';

dotenv.config();

const DELAY_MS = 5000;
const PRIVATE_KEYS_PATH = './private_keys.txt';

// 🚀 Baca private key dari file .txt
let PRIVATE_KEYS = [];
try {
    const rawKeys = fs.readFileSync(PRIVATE_KEYS_PATH, 'utf8');
    PRIVATE_KEYS = rawKeys
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
} catch (err) {
    console.error(chalk.red(`❌ Gagal membaca file ${PRIVATE_KEYS_PATH}: ${err.message}`));
    process.exit(1);
}

if (PRIVATE_KEYS.length === 0) {
    console.error(chalk.red("❌ Tidak ada private key ditemukan dalam file."));
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// 📦 Compile Solidity contract
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

// 📟 Prompt input
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

// 💤 Delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 🎯 Main deploy logic
async function main() {
    const userInput = await askUser(chalk.blueBright("🔢 Berapa jumlah kontrak yang ingin kamu buat? "));
    const totalContracts = parseInt(userInput);

    if (isNaN(totalContracts) || totalContracts <= 0) {
        console.error(chalk.red("❌ Input tidak valid. Masukkan angka lebih dari 0."));
        return;
    }

    console.log(chalk.cyan(`\n🚀 Deploying ${totalContracts} contract(s) dengan ${PRIVATE_KEYS.length} akun...\n`));

    for (let i = 0; i < totalContracts; i++) {
        const keyIndex = i % PRIVATE_KEYS.length;
        const wallet = new ethers.Wallet(PRIVATE_KEYS[keyIndex], provider);
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);

        console.log(chalk.yellow(`🚧 [Akun ${keyIndex + 1}] Deploying contract #${i + 1} dari ${wallet.address}...`));

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

        console.log(chalk.green(`✅ Contract #${i + 1} berhasil dideploy di: ${contract.target}\n`));

        if (i < totalContracts - 1) {
            console.log(chalk.gray(`⏳ Menunggu ${DELAY_MS / 1000} detik sebelum deploy berikutnya...\n`));
            await delay(DELAY_MS);
        }
    }

    console.log(chalk.black.bgGreen("🎉 Semua kontrak berhasil dideploy!"));
}

// 🎨 Banner + Jalankan
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
