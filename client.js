const readline = require('readline');
const fs = require('fs');
const { Wallet } = require('./wallet');
const { Blockchain, Transaction } = require('./blockchain');
const { Miner } = require('./miner');
const { P2PNode } = require('./p2p');
const http = require('http');

class VBlockchainClient {
  constructor() {
    this.wallet = null;
    this.blockchain = null;
    this.miner = null;
    this.p2pNode = null;
    this.serverAddress = 'http://localhost:3000';
    this.miningInterval = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              V-BLOCKCHAIN CLIENT v1.0                      ║');
    console.log('║           Proof of Vote Consensus Network                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const choice = await this.question('Do you have an existing wallet? (yes/no): ');

    if (choice.toLowerCase() === 'yes') {
      await this.loadWallet();
    } else {
      await this.createNewWallet();
    }

    if (this.wallet) {
      this.blockchain = new Blockchain(this.wallet.address);
      this.p2pNode = new P2PNode(
        this.wallet.address,
        4000 + Math.floor(Math.random() * 1000),
        this.serverAddress
      );
      this.p2pNode.setBlockchain(this.blockchain);
      this.p2pNode.start();

      this.miner = new Miner(this.wallet.address, this.blockchain, this.p2pNode);

      await this.registerOnServer();
      await this.mainMenu();
    }
  }

  async createNewWallet() {
    const username = await this.question('Enter a username: ');
    this.wallet = new Wallet(username);
    this.wallet.generateKeys();
    this.wallet.saveToFile();

    console.log('\n✓ Wallet created successfully!');
    await this.wallet.displayWalletInfo();

    const generateQR = await this.question('Generate QR code? (yes/no): ');
    if (generateQR.toLowerCase() === 'yes') {
      const qrPath = await this.wallet.generateQRCode();
      console.log(`✓ QR Code saved: ${qrPath}`);
    }
  }

  async loadWallet() {
    const username = await this.question('Enter username: ');
    const walletFile = `wallet_${username}.json`;

    if (!fs.existsSync(walletFile)) {
      console.log('✗ Wallet not found');
      return;
    }

    this.wallet = Wallet.loadFromFile(walletFile);
    console.log('✓ Wallet loaded successfully');
    await this.wallet.displayWalletInfo();
  }

  async registerOnServer() {
    console.log('\n[Network] Registering on server...');
    
    const nodeId = this.wallet.address;
    const port = this.p2pNode.port;

    try {
      const response = await this.makeRequest('POST', '/register-node', {
        nodeId,
        host: 'localhost',
        port,
        publicKey: this.wallet.publicKey.substring(0, 200)
      });

      console.log('✓ Registered on network');
      console.log(`✓ Found ${response.peers.length} peers in network`);

      const registerAddr = await this.question('\nRegister address on server? (yes/no): ');
      if (registerAddr.toLowerCase() === 'yes') {
        await this.registerAddressOnServer();
      }
    } catch (error) {
      console.log('⚠ Could not register on server:', error.message);
    }
  }

  async registerAddressOnServer() {
    try {
      await this.makeRequest('POST', '/register-address', {
        address: this.wallet.address,
        username: this.wallet.username,
        publicKey: this.wallet.publicKey.substring(0, 200)
      });
      console.log('✓ Address registered with 50 V welcome bonus!');
    } catch (error) {
      console.log('✗ Failed to register address:', error.message);
    }
  }

  async mainMenu() {
    let running = true;
    while (running) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                        MAIN MENU                           ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('1. View Wallet Info');
      console.log('2. Send Transaction');
      console.log('3. View Transaction History');
      console.log('4. Start Mining');
      console.log('5. Stop Mining');
      console.log('6. Cast Vote on Block');
      console.log('7. View Blockchain');
      console.log('8. Display QR Code');
      console.log('9. Network Stats');
      console.log('0. Exit');
      console.log('════════════════════════════════════════════════════════════');

      const choice = await this.question('Select option: ');

      switch (choice) {
        case '1':
          await this.wallet.displayWalletInfo();
          const balance = this.blockchain.getBalance(this.wallet.address);
          console.log(`Balance in blockchain: ${balance} V`);
          break;
        case '2':
          await this.sendTransaction();
          break;
        case '3':
          this.viewTransactionHistory();
          break;
        case '4':
          this.startMining();
          break;
        case '5':
          this.miner.stopMining();
          break;
        case '6':
          await this.castVote();
          break;
        case '7':
          this.viewBlockchain();
          break;
        case '8':
          await this.displayQRCode();
          break;
        case '9':
          await this.viewNetworkStats();
          break;
        case '0':
          running = false;
          console.log('\nShutting down...');
          break;
        default:
          console.log('✗ Invalid option');
      }
    }

    this.cleanup();
  }

  async sendTransaction() {
    const receiver = await this.question('Receiver address: ');
    const amountStr = await this.question('Amount (V): ');
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) {
      console.log('✗ Invalid amount');
      return;
    }

    const balance = this.blockchain.getBalance(this.wallet.address);
    if (balance < amount) {
      console.log(`✗ Insufficient balance. Current: ${balance} V`);
      return;
    }

    const transaction = new Transaction(
      this.wallet.address,
      receiver,
      amount
    );

    transaction.sign(this.wallet.privateKey);
    transaction.publicKey = this.wallet.publicKey;

    if (this.blockchain.addTransaction(transaction)) {
      console.log('✓ Transaction added to pending queue');
      this.p2pNode.broadcastNewTransaction(transaction);
    } else {
      console.log('✗ Transaction invalid');
    }
  }

  viewTransactionHistory() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                 TRANSACTION HISTORY                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    let count = 0;
    for (const block of this.blockchain.chain) {
      for (const tx of block.transactions) {
        if (tx.sender === this.wallet.address || tx.receiver === this.wallet.address) {
          console.log(`\nTx #${count++}:`);
          console.log(`  From: ${tx.sender}`);
          console.log(`  To: ${tx.receiver}`);
          console.log(`  Amount: ${tx.amount} V`);
          console.log(`  Time: ${new Date(tx.timestamp).toLocaleString()}`);
        }
      }
    }

    if (count === 0) {
      console.log('No transactions found');
    }
  }

  startMining() {
    const miningInterval = this.miner.startMining((block) => {
      console.log(`\n✓ NEW BLOCK MINED!`);
      console.log(`  Index: ${block.index}`);
      console.log(`  Hash: ${block.calculateHash()}`);
      console.log(`  Transactions: ${block.transactions.length}`);
    });
    this.miningInterval = miningInterval;
  }

  async castVote() {
    const choice = await this.question('Vote YES or NO (yes/no): ');
    const voteValue = choice.toLowerCase() === 'yes';
    
    const blockIndex = this.blockchain.chain.length - 1;
    const result = this.miner.castVote(blockIndex, voteValue);
    
    console.log(`Vote recorded. Approval: ${result.percentage.toFixed(2)}%`);
    console.log(`Threshold: ${this.blockchain.voteThreshold}%`);
  }

  viewBlockchain() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      BLOCKCHAIN                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    for (let i = 0; i < this.blockchain.chain.length; i++) {
      const block = this.blockchain.chain[i];
      console.log(`\nBlock #${block.index}:`);
      console.log(`  Hash: ${block.calculateHash()}`);
      console.log(`  Previous: ${block.previousHash}`);
      console.log(`  Miner: ${block.miner}`);
      console.log(`  Transactions: ${block.transactions.length}`);
      console.log(`  Timestamp: ${new Date(block.timestamp).toLocaleString()}`);
      console.log(`  Nonce: ${block.nonce}`);
      const votePercentage = block.getVotePercentage();
      console.log(`  Votes: ${Object.keys(block.votes).length} (${votePercentage.toFixed(2)}% approved)`);
    }

    console.log(`\nChain valid: ${this.blockchain.isChainValid()}`);
  }

  async displayQRCode() {
    const qrPath = await this.wallet.generateQRCode();
    console.log(`✓ QR Code generated: ${qrPath}`);
    console.log(`✓ Your address: ${this.wallet.address}`);
    console.log(`✓ Share this QR code or address to receive V tokens`);
  }

  async viewNetworkStats() {
    try {
      const stats = await this.makeRequest('GET', '/network-stats');
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║                   NETWORK STATISTICS                       ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log(`Total Nodes: ${stats.totalNodes}`);
      console.log(`Active Nodes: ${stats.activeNodes}`);
      console.log(`Registered Addresses: ${stats.totalAddresses}`);
      console.log(`Total V in Circulation: ${stats.totalV} V`);
    } catch (error) {
      console.log('✗ Could not fetch network stats:', error.message);
    }
  }

  makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.serverAddress + path);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(body);
          }
        });
      });

      req.on('error', reject);

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  question(prompt) {
    return new Promise(resolve => {
      this.rl.question(prompt, resolve);
    });
  }

  cleanup() {
    this.miner.stopMining();
    this.p2pNode.close();
    this.rl.close();
    process.exit(0);
  }
}

const client = new VBlockchainClient();
client.initialize().catch(console.error);
