const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { Blockchain, Transaction } = require('./blockchain');
const { Wallet } = require('./wallet');
const { P2PNode } = require('./p2p');
const { Miner } = require('./miner');
const fs = require('fs');
const http = require('http');

let mainWindow;
let blockchain;
let wallet = null;
let miner = null;
let p2pNode = null;
let miningInterval = null;
let currentNodeData = {};

const SERVER_ADDRESS = 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: null
  });

  mainWindow.loadFile('gui/index.html');

  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

function setupP2PListeners() {
  if (!p2pNode) return;

  p2pNode.on('newBlock', (block) => {
    console.log(`[Main] Received new block #${block.index} from P2P network`);
    if (blockchain && block && typeof block.index !== 'undefined') {
      if (block.index === blockchain.chain.length) {
        try {
          blockchain.chain.push(block);
          blockchain.saveToFile();
          console.log(`[Main] ✓ Block #${block.index} added to blockchain`);
          sendToRenderer('block-received', {
            index: block.index,
            transactions: block.transactions.length
          });
        } catch (e) {
          console.error(`[Main] Error adding block: ${e.message}`);
        }
      } else {
        console.log(`[Main] Block index mismatch: got ${block.index}, expected ${blockchain.chain.length}`);
      }
    }
  });

  p2pNode.on('newTransaction', (transaction) => {
    console.log(`[Main] Received transaction from ${transaction.sender.substring(0,8)}... to ${transaction.receiver.substring(0,8)}...`);
    if (blockchain && transaction) {
      try {
        if (blockchain.addTransaction(transaction)) {
          blockchain.saveToFile();
          console.log(`[Main] ✓ Transaction added to pending pool (total pending: ${blockchain.pendingTransactions.length})`);
        } else {
          console.log('[Main] Transaction rejected');
        }
      } catch (e) {
        console.error(`[Main] Error adding transaction: ${e.message}`);
      }
    }
  });

  p2pNode.on('vote', (voteData) => {
    console.log('[Main] Received vote from P2P network');
    if (blockchain && voteData && blockchain.chain.length > voteData.blockIndex) {
      try {
        blockchain.chain[voteData.blockIndex].addVote(voteData.voter, voteData.voteValue);
        blockchain.saveToFile();
        console.log('[Main] ✓ Vote added to block');
      } catch (e) {
        console.error(`[Main] Error adding vote: ${e.message}`);
      }
    }
  });
}

function cleanup() {
  if (miner) {
    miner.stopMining();
  }
  if (p2pNode) {
    p2pNode.close();
  }
}

function sendToRenderer(channel, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(channel, data);
  }
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(SERVER_ADDRESS + path);
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

ipcMain.handle('create-wallet', async (event, username, password) => {
  try {
    wallet = new Wallet(username, password);
    wallet.generateKeys();
    wallet.saveToFile();

    blockchain = new Blockchain(wallet.address);
    
    const welcomeBonus = new Transaction('SYSTEM', wallet.address, 50);
    blockchain.addTransaction(welcomeBonus);
    blockchain.minePendingTransactions(wallet.address);
    blockchain.saveToFile();
    
    p2pNode = new P2PNode(
      wallet.address,
      4000 + Math.floor(Math.random() * 1000),
      SERVER_ADDRESS
    );
    p2pNode.setBlockchain(blockchain);
    p2pNode.start();
    setupP2PListeners();

    miner = new Miner(wallet.address, blockchain, p2pNode);

    currentNodeData = {
      username: wallet.username,
      address: wallet.address,
      port: p2pNode.port
    };

    return {
      success: true,
      wallet: {
        username: wallet.username,
        address: wallet.address,
        balance: blockchain.getBalance(wallet.address),
        publicKey: wallet.publicKey.substring(0, 100) + '...'
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-wallet', async (event, username, password) => {
  try {
    const walletFile = `wallet_${username}.json`;
    if (!fs.existsSync(walletFile)) {
      return { success: false, error: 'Wallet not found' };
    }

    wallet = Wallet.loadFromFile(walletFile, password);
    
    const blockchainFile = `blockchain_${wallet.address}.json`;
    if (fs.existsSync(blockchainFile)) {
      blockchain = Blockchain.loadFromFile(blockchainFile);
    } else {
      blockchain = new Blockchain(wallet.address);
      const welcomeBonus = new Transaction('SYSTEM', wallet.address, 50);
      blockchain.addTransaction(welcomeBonus);
      blockchain.minePendingTransactions(wallet.address);
      blockchain.saveToFile();
    }
    
    p2pNode = new P2PNode(
      wallet.address,
      4000 + Math.floor(Math.random() * 1000),
      SERVER_ADDRESS
    );
    p2pNode.setBlockchain(blockchain);
    p2pNode.start();
    setupP2PListeners();

    miner = new Miner(wallet.address, blockchain, p2pNode);

    currentNodeData = {
      username: wallet.username,
      address: wallet.address,
      port: p2pNode.port
    };

    return {
      success: true,
      wallet: {
        username: wallet.username,
        address: wallet.address,
        balance: blockchain.getBalance(wallet.address),
        publicKey: wallet.publicKey.substring(0, 100) + '...'
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('register-on-server', async (event) => {
  try {
    const response = await makeRequest('POST', '/register-node', {
      nodeId: wallet.address,
      host: 'localhost',
      port: p2pNode.port,
      publicKey: wallet.publicKey.substring(0, 200)
    });

    const addrResponse = await makeRequest('POST', '/register-address', {
      address: wallet.address,
      username: wallet.username,
      publicKey: wallet.publicKey.substring(0, 200)
    });

    return {
      success: true,
      message: 'Registered on network',
      peers: response.peers ? response.peers.length : 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-wallet-info', async (event) => {
  if (!wallet) {
    return { success: false, error: 'No wallet loaded' };
  }

  const balance = blockchain.getBalance(wallet.address);
  return {
    success: true,
    wallet: {
      username: wallet.username,
      address: wallet.address,
      balance,
      publicKey: wallet.publicKey.substring(0, 100) + '...',
      createdAt: new Date(wallet.createdAt).toLocaleString()
    }
  };
});

ipcMain.handle('send-transaction', async (event, receiver, amount) => {
  try {
    const balance = blockchain.getBalance(wallet.address);
    if (balance < amount) {
      return { success: false, error: `Insufficient balance. Current: ${balance} V` };
    }

    const transaction = new Transaction(wallet.address, receiver, amount);
    transaction.sign(wallet.privateKey);
    transaction.publicKey = wallet.publicKey;

    if (blockchain.addTransaction(transaction)) {
      blockchain.saveToFile();
      p2pNode.broadcastNewTransaction(transaction);
      return { success: true, message: 'Transaction sent', txHash: transaction.hash };
    } else {
      return { success: false, error: 'Invalid transaction' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-mining', async (event) => {
  try {
    if (miningInterval) {
      return { success: false, error: 'Mining already running' };
    }

    miningInterval = miner.startMining((block) => {
      blockchain.saveToFile();
      sendToRenderer('block-mined', {
        index: block.index,
        hash: block.calculateHash(),
        transactions: block.transactions.length
      });
    });

    return { success: true, message: 'Mining started' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-mining', async (event) => {
  try {
    if (miningInterval) {
      clearInterval(miningInterval);
      miningInterval = null;
    }
    miner.stopMining();
    return { success: true, message: 'Mining stopped' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cast-vote', async (event, voteValue) => {
  try {
    const blockIndex = blockchain.chain.length - 1;
    const result = miner.castVote(blockIndex, voteValue);
    blockchain.saveToFile();
    return {
      success: true,
      approved: result.approved,
      percentage: result.percentage.toFixed(2)
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-blockchain', async (event) => {
  try {
    const chain = blockchain.chain.map(block => ({
      index: block.index,
      hash: block.calculateHash(),
      previousHash: block.previousHash,
      miner: block.miner,
      timestamp: new Date(block.timestamp).toLocaleString(),
      transactions: block.transactions.length,
      nonce: block.nonce,
      votes: Object.keys(block.votes).length,
      votePercentage: block.getVotePercentage().toFixed(2)
    }));

    return { success: true, chain, isValid: blockchain.isChainValid() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-block-details', async (event, blockIndex) => {
  try {
    if (blockIndex >= blockchain.chain.length) {
      return { success: false, error: 'Block not found' };
    }

    const block = blockchain.chain[blockIndex];
    const transactions = block.transactions.map(tx => ({
      sender: tx.sender,
      receiver: tx.receiver,
      amount: tx.amount,
      timestamp: new Date(tx.timestamp).toLocaleString()
    }));

    return {
      success: true,
      block: {
        index: block.index,
        hash: block.calculateHash(),
        previousHash: block.previousHash,
        miner: block.miner,
        timestamp: new Date(block.timestamp).toLocaleString(),
        transactions,
        nonce: block.nonce,
        votes: block.votes,
        votePercentage: block.getVotePercentage().toFixed(2)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-transaction-history', async (event) => {
  try {
    const history = [];
    for (const block of blockchain.chain) {
      for (const tx of block.transactions) {
        if (tx.sender === wallet.address || tx.receiver === wallet.address) {
          history.push({
            sender: tx.sender,
            receiver: tx.receiver,
            amount: tx.amount,
            timestamp: new Date(tx.timestamp).toLocaleString(),
            type: tx.sender === wallet.address ? 'sent' : 'received'
          });
        }
      }
    }
    return { success: true, history };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('generate-qr-code', async (event) => {
  try {
    const qrPath = await wallet.generateQRCode();
    return { success: true, path: qrPath, address: wallet.address };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-network-stats', async (event) => {
  try {
    const stats = await makeRequest('GET', '/network-stats');
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-miner-stats', async (event) => {
  try {
    const stats = miner.getBlockchainStats();
    return { success: true, stats };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
