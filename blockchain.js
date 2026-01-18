const crypto = require('crypto');
const fs = require('fs');

class Transaction {
  constructor(sender, receiver, amount, timestamp = Date.now()) {
    this.sender = sender;
    this.receiver = receiver;
    this.amount = amount;
    this.timestamp = timestamp;
  }

  calculateHash() {
    const txString = JSON.stringify({
      sender: this.sender,
      receiver: this.receiver,
      amount: this.amount,
      timestamp: this.timestamp
    });
    return crypto.createHash('sha256').update(txString).digest('hex');
  }

  sign(privateKey) {
    this.hash = this.calculateHash();
    this.signature = crypto.sign(
      'sha256',
      Buffer.from(this.hash),
      {
        key: privateKey,
        format: 'pem'
      }
    ).toString('hex');
  }

  isValid(publicKey) {
    if (this.sender === 'SYSTEM') {
      return true;
    }
    if (!this.signature || !this.hash) return false;
    try {
      return crypto.verify(
        'sha256',
        Buffer.from(this.hash),
        {
          key: publicKey,
          format: 'pem'
        },
        Buffer.from(this.signature, 'hex')
      );
    } catch (e) {
      return false;
    }
  }
}

class Block {
  constructor(index, transactions, previousHash, miner, timestamp = Date.now()) {
    this.index = index;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.miner = miner;
    this.nonce = 0;
    this.votes = {};
  }

  calculateHash() {
    const blockString = JSON.stringify({
      index: this.index,
      transactions: this.transactions,
      previousHash: this.previousHash,
      timestamp: this.timestamp,
      miner: this.miner,
      nonce: this.nonce
    });
    return crypto.createHash('sha256').update(blockString).digest('hex');
  }

  mineBlock(difficulty = 2) {
    while (!this.calculateHash().startsWith('0'.repeat(difficulty))) {
      this.nonce++;
    }
    return this.calculateHash();
  }

  addVote(voter, voteValue) {
    this.votes[voter] = voteValue;
  }

  getVotePercentage() {
    const votes = Object.values(this.votes);
    if (votes.length === 0) return 0;
    const approved = votes.filter(v => v === true).length;
    return (approved / votes.length) * 100;
  }

  isVoteApproved(threshold = 66.7) {
    return this.getVotePercentage() >= threshold;
  }
}

class Blockchain {
  constructor(nodeAddress) {
    this.chain = [];
    this.pendingTransactions = [];
    this.nodeAddress = nodeAddress;
    this.difficulty = 2;
    this.voteThreshold = 66.7;
    this.votingPower = {};
    this.balances = {};
    this.minerReward = 10;

    this.createGenesisBlock();
  }

  createGenesisBlock() {
    const genesisBlock = new Block(0, [], '0', 'SYSTEM', Date.now());
    genesisBlock.mineBlock(this.difficulty);
    this.chain.push(genesisBlock);
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addTransaction(transaction) {
    if (transaction.sender !== 'SYSTEM') {
      if (!transaction.publicKey || !transaction.isValid(transaction.publicKey)) {
        return false;
      }
    }
    this.pendingTransactions.push(transaction);
    return true;
  }

  minePendingTransactions(minerAddress) {
    const coinbaseTransaction = new Transaction('SYSTEM', minerAddress, this.minerReward);
    this.pendingTransactions.push(coinbaseTransaction);

    const newBlock = new Block(
      this.chain.length,
      this.pendingTransactions,
      this.getLatestBlock().calculateHash(),
      minerAddress
    );

    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    this.pendingTransactions = [];

    return newBlock;
  }

  addVoteToLatestBlock(voter, voteValue, votingPower = 1) {
    const latestBlock = this.getLatestBlock();
    latestBlock.addVote(voter, voteValue);
    return latestBlock.getVotePercentage();
  }

  isVoteApprovedForLatestBlock() {
    return this.getLatestBlock().isVoteApproved(this.voteThreshold);
  }

  getBalance(address) {
    let balance = 0;
    for (const block of this.chain) {
      for (const transaction of block.transactions) {
        if (transaction.sender === address) {
          balance -= transaction.amount;
        }
        if (transaction.receiver === address) {
          balance += transaction.amount;
        }
      }
    }
    return balance;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.calculateHash() === '') {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.calculateHash()) {
        return false;
      }

      const votes = Object.values(currentBlock.votes);
      const hasVotes = votes.length > 0;
      if (hasVotes && !currentBlock.isVoteApproved(this.voteThreshold)) {
        return false;
      }
    }
    return true;
  }

  getAllAddresses() {
    const addresses = new Set();
    for (const block of this.chain) {
      for (const transaction of block.transactions) {
        addresses.add(transaction.sender);
        addresses.add(transaction.receiver);
      }
    }
    return Array.from(addresses);
  }

  saveToFile(filename = `blockchain_${this.nodeAddress}.json`) {
    const chainData = {
      nodeAddress: this.nodeAddress,
      difficulty: this.difficulty,
      voteThreshold: this.voteThreshold,
      minerReward: this.minerReward,
      chain: this.chain,
      pendingTransactions: this.pendingTransactions,
      votingPower: this.votingPower
    };
    fs.writeFileSync(filename, JSON.stringify(chainData, null, 2));
    return filename;
  }

  static loadFromFile(filename) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const blockchain = new Blockchain(data.nodeAddress);
    
    blockchain.chain = data.chain.map(blockData => {
      const block = new Block(
        blockData.index,
        blockData.transactions,
        blockData.previousHash,
        blockData.miner,
        blockData.timestamp
      );
      block.nonce = blockData.nonce;
      block.votes = blockData.votes || {};
      return block;
    });
    
    blockchain.pendingTransactions = data.pendingTransactions.map(txData => {
      const tx = new Transaction(txData.sender, txData.receiver, txData.amount, txData.timestamp);
      tx.hash = txData.hash;
      tx.signature = txData.signature;
      tx.publicKey = txData.publicKey;
      return tx;
    });
    
    blockchain.difficulty = data.difficulty;
    blockchain.voteThreshold = data.voteThreshold;
    blockchain.minerReward = data.minerReward;
    blockchain.votingPower = data.votingPower;
    return blockchain;
  }
}

module.exports = { Blockchain, Block, Transaction };
