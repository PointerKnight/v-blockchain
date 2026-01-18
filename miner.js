const { Transaction } = require('./blockchain');

class Miner {
  constructor(address, blockchain, p2pNode) {
    this.address = address;
    this.blockchain = blockchain;
    this.p2pNode = p2pNode;
    this.isMining = false;
  }

  startMining(onBlockMined = null) {
    if (this.isMining) {
      console.log('[Miner] Mining already in progress');
      return;
    }

    this.isMining = true;
    console.log(`[Miner] Starting mining with address: ${this.address}`);

    const miningInterval = setInterval(() => {
      if (!this.isMining) {
        clearInterval(miningInterval);
        return;
      }

      if (this.blockchain.pendingTransactions.length > 0) {
        console.log('[Miner] Mining new block...');
        
        const block = this.blockchain.minePendingTransactions(this.address);
        console.log(`[Miner] ✓ Block mined: ${block.calculateHash()}`);
        console.log(`[Miner] Block index: ${block.index}`);
        console.log(`[Miner] Miner reward: +10 V`);

        if (this.p2pNode) {
          this.p2pNode.broadcastNewBlock(block);
        }

        if (onBlockMined) {
          onBlockMined(block);
        }
      }
    }, 5000);

    return miningInterval;
  }

  stopMining() {
    this.isMining = false;
    console.log('[Miner] Mining stopped');
  }

  castVote(blockIndex, voteValue = true) {
    const votePercentage = this.blockchain.addVoteToLatestBlock(
      this.address,
      voteValue
    );

    console.log(`[Vote] ${this.address} voted ${voteValue ? 'YES' : 'NO'}`);
    console.log(`[Vote] Current approval: ${votePercentage.toFixed(2)}%`);

    if (this.p2pNode) {
      this.p2pNode.broadcastVote(this.address, blockIndex, voteValue);
    }

    if (this.blockchain.isVoteApprovedForLatestBlock()) {
      console.log('✓ Block approved by vote!');
      return { approved: true, percentage: votePercentage };
    }

    return { approved: false, percentage: votePercentage };
  }

  getBlockchainStats() {
    const balance = this.blockchain.getBalance(this.address);
    const chainLength = this.blockchain.chain.length;
    const pendingCount = this.blockchain.pendingTransactions.length;

    return {
      minerAddress: this.address,
      balance,
      chainLength,
      pendingTransactions: pendingCount,
      isChainValid: this.blockchain.isChainValid(),
      latestBlockHash: this.blockchain.getLatestBlock().calculateHash(),
      voteThreshold: `${this.blockchain.voteThreshold}%`
    };
  }
}

module.exports = { Miner };
