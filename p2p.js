const net = require('net');
const EventEmitter = require('events');
const http = require('http');

class P2PNode extends EventEmitter {
  constructor(nodeId, port, serverAddress = null) {
    super();
    this.nodeId = nodeId;
    this.port = port;
    this.serverAddress = serverAddress;
    this.peers = new Map();
    this.server = null;
    this.blockchain = null;
    this.discoveryInterval = null;
  }

  setBlockchain(blockchain) {
    this.blockchain = blockchain;
  }

  start() {
    this.server = net.createServer((socket) => {
      console.log(`[P2P] New connection from ${socket.remoteAddress}:${socket.remotePort}`);

      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message, socket);
        } catch (e) {
          console.error('[P2P] Error parsing message:', e.message);
        }
      });

      socket.on('error', (err) => {
        console.error('[P2P] Socket error:', err.message);
      });

      socket.on('end', () => {
        console.log(`[P2P] Connection closed: ${socket.remoteAddress}`);
      });
    });

    this.server.listen(this.port, () => {
      console.log(`[P2P] Node ${this.nodeId} listening on port ${this.port}`);
    });

    if (this.serverAddress) {
      this.startPeerDiscovery();
    }
  }

  startPeerDiscovery() {
    this.discoveryInterval = setInterval(() => {
      this.discoverPeers();
    }, 10000);
    this.discoverPeers();
  }

  discoverPeers() {
    if (!this.serverAddress) return;

    const url = new URL(this.serverAddress + '/get-all-nodes');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const nodes = JSON.parse(data);
          nodes.forEach(node => {
            if (node.nodeId !== this.nodeId && !this.peers.has(node.nodeId)) {
              this.connectToPeer(node.nodeId, 'localhost', node.port).catch(() => {});
            }
          });
        } catch (e) {
          console.error('[P2P] Error parsing peers:', e.message);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[P2P] Peer discovery failed:', err.message);
    });

    req.end();
  }

  close() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.server) {
      this.server.close();
    }
    this.peers.forEach(socket => socket.destroy());
    this.peers.clear();
  }

  handleMessage(message, socket) {
    console.log(`[P2P] Received message type: ${message.type} from ${message.nodeId}`);

    switch (message.type) {
      case 'SYNC_BLOCKCHAIN':
        this.handleBlockchainSync(message, socket);
        break;
      case 'NEW_BLOCK':
        this.handleNewBlock(message, socket);
        break;
      case 'NEW_TRANSACTION':
        this.handleNewTransaction(message, socket);
        break;
      case 'VOTE':
        this.handleVote(message, socket);
        break;
      case 'PEERS_LIST':
        this.handlePeersList(message, socket);
        break;
      default:
        console.log('[P2P] Unknown message type:', message.type);
    }
  }

  handleBlockchainSync(message, socket) {
    console.log('[P2P] Syncing blockchain...');
    const response = {
      type: 'BLOCKCHAIN_DATA',
      nodeId: this.nodeId,
      chain: this.blockchain.chain.map(block => ({
        index: block.index,
        transactions: block.transactions,
        previousHash: block.previousHash,
        miner: block.miner,
        timestamp: block.timestamp,
        nonce: block.nonce,
        votes: block.votes
      }))
    };
    this.sendMessage(socket, response);
  }

  handleNewBlock(message, socket) {
    console.log('[P2P] Received new block from', message.nodeId);
    const blockData = message.block;
    if (blockData) {
      const { Block, Transaction } = require('./blockchain');
      const block = new Block(
        blockData.index,
        blockData.transactions.map(txData => {
          const tx = new Transaction(txData.sender, txData.receiver, txData.amount, txData.timestamp);
          tx.hash = txData.hash;
          tx.signature = txData.signature;
          tx.publicKey = txData.publicKey;
          return tx;
        }),
        blockData.previousHash,
        blockData.miner,
        blockData.timestamp
      );
      block.nonce = blockData.nonce;
      block.votes = blockData.votes || {};
      this.emit('newBlock', block);
    }
  }

  handleNewTransaction(message, socket) {
    console.log('[P2P] Received new transaction from', message.nodeId);
    const txData = message.transaction;
    if (txData) {
      const { Transaction } = require('./blockchain');
      const tx = new Transaction(txData.sender, txData.receiver, txData.amount, txData.timestamp);
      tx.hash = txData.hash;
      tx.signature = txData.signature;
      tx.publicKey = txData.publicKey;
      this.emit('newTransaction', tx);
    }
  }

  handleVote(message, socket) {
    console.log('[P2P] Received vote from', message.voter);
    this.emit('vote', {
      voter: message.voter,
      blockIndex: message.blockIndex,
      voteValue: message.voteValue
    });
  }

  handlePeersList(message, socket) {
    console.log('[P2P] Received peers list:', message.peers);
    this.emit('peersList', message.peers);
  }

  connectToPeer(peerId, host, port) {
    return new Promise((resolve, reject) => {
      if (this.peers.has(peerId)) {
        resolve(this.peers.get(peerId));
        return;
      }

      const socket = new net.Socket();
      socket.connect(port, host, () => {
        console.log(`[P2P] Connected to peer ${peerId} at ${host}:${port}`);
        this.peers.set(peerId, socket);
        resolve(socket);
      });

      socket.on('error', (err) => {
        console.error(`[P2P] Failed to connect to peer ${peerId}:`, err.message);
        reject(err);
      });

      socket.on('end', () => {
        this.peers.delete(peerId);
        console.log(`[P2P] Peer ${peerId} disconnected`);
      });
    });
  }

  sendMessage(socket, message) {
    try {
      socket.write(JSON.stringify(message) + '\n');
    } catch (e) {
      console.error('[P2P] Error sending message:', e.message);
    }
  }

  broadcastMessage(messageType, data) {
    const message = {
      type: messageType,
      nodeId: this.nodeId,
      ...data
    };

    this.peers.forEach((socket, peerId) => {
      try {
        this.sendMessage(socket, message);
      } catch (e) {
        console.error(`[P2P] Failed to send to ${peerId}:`, e.message);
      }
    });
  }

  broadcastNewBlock(block) {
    this.broadcastMessage('NEW_BLOCK', { block });
  }

  broadcastNewTransaction(transaction) {
    this.broadcastMessage('NEW_TRANSACTION', { transaction });
  }

  broadcastVote(voter, blockIndex, voteValue) {
    this.broadcastMessage('VOTE', { voter, blockIndex, voteValue });
  }

  requestBlockchainSync(peerId, host, port) {
    return this.connectToPeer(peerId, host, port).then((socket) => {
      const message = {
        type: 'SYNC_BLOCKCHAIN',
        nodeId: this.nodeId
      };
      this.sendMessage(socket, message);
    });
  }

  close() {
    if (this.server) {
      this.server.close();
    }
    this.peers.forEach((socket) => socket.destroy());
  }
}

module.exports = { P2PNode };
