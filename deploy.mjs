import dotenv from 'dotenv';
import fs from 'node:fs';
import solc from 'solc';
import { ethers } from 'ethers';
import readline from 'node:readline';
import chalk from 'chalk';
import figlet from 'figlet';

dotenv.config();

const DELAY_MS = 5000;
const PRIVATE_KEYS_PATH = './private_keys.txt';

// Baca private key dari file
let PRIVATE_KEYS = [];
try {
    const rawKeys = fs.readFileSync(PRIVATE_KEYS_PATH, 'utf8');
    PRIVATE_KEYS = rawKeys
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
} catch (err) {
    console.error(chalk.red(`Gagal membaca file ${PRIVATE_KEYS_PATH}: ${err.message}`));
    process.exit(1);
}

if (PRIVATE_KEYS.length === 0) {
    console.error(chalk.red("Tidak ada private key ditemukan dalam file."));
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Compile contract
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

// Helper: Input
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

// Helper: Delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Main deploy logic
async function main() {
    const userInput = await askUser(chalk.blueBright("Masukkan jumlah kontrak yang ingin dibuat per akun: "));
    const deployPerAccount = parseInt(userInput);

    if (isNaN(deployPerAccount) || deployPerAccount <= 0) {
        console.error(chalk.red("Input tidak valid. Masukkan angka lebih dari 0."));
        return;
    }

    console.log(chalk.cyan(`\nDeploy ${deployPerAccount} kontrak untuk setiap dari ${PRIVATE_KEYS.length} akun...\n`));

    for (let i = 0; i < PRIVATE_KEYS.length; i++) {
        const wallet = new ethers.Wallet(PRIVATE_KEYS[i], provider);
        const factory = new ethers.ContractFactory(abi, bytecode, wallet);

        console.log(chalk.yellow(`\n========================`));
        console.log(chalk.yellow(`Akun ${i + 1}: ${wallet.address}`));

        for (let j = 0; j < deployPerAccount; j++) {
            console.log(chalk.yellow(`Deploy #${j + 1} untuk akun ${i + 1}`));

            try {
                const estimatedGas = await provider.estimateGas({
                    from: wallet.address,
                    data: "0x" + bytecode,
                });

                const gasPriceHex = await provider.send("eth_gasPrice", []);
                const gasPrice = BigInt(gasPriceHex);
                const estimatedCost = gasPrice * BigInt(estimatedGas);
                const ethCost = ethers.formatEther(estimatedCost);

                console.log(`Estimasi gas: ${chalk.magenta(estimatedGas)} @ ${chalk.magenta(ethers.formatUnits(gasPrice, "gwei"))} gwei`);
                console.log(`Estimasi biaya: ~${chalk.green(ethCost)} ETH`);

                const contract = await factory.deploy();
                await contract.waitForDeployment();

                console.log(chalk.green(`Contract berhasil dideploy di: ${contract.target}\n`));
                fs.appendFileSync('deployed_contracts.txt', `${wallet.address} => ${contract.target}\n`);
            } catch (err) {
                console.error(chalk.red(`Deploy gagal: ${err.message}`));
            }

            if (j < deployPerAccount - 1) {
                console.log(chalk.gray(`Menunggu ${DELAY_MS / 1000} detik...\n`));
                await delay(DELAY_MS);
            }
        }

        if (i < PRIVATE_KEYS.length - 1) {
            console.log(chalk.gray(`Selesai akun ${i + 1}, lanjut dalam ${DELAY_MS / 1000} detik...\n`));
            await delay(DELAY_MS);
        }
    }

    console.log(chalk.black.bgGreen("Semua kontrak selesai dideploy!"));
}

// Banner dan mulai
figlet.text('karpal', { horizontalLayout: 'default' }, function (err, data) {
    if (err) {
        console.log('Error saat menampilkan banner:');
        console.dir(err);
        return;
    }
    console.log(chalk.green(data));
    main().catch((err) => {
        console.error(chalk.bgRed("Gagal:"), chalk.red(err));
    });
});
