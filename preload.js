const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blockchain', {
  createWallet: (username, password) => ipcRenderer.invoke('create-wallet', username, password),
  loadWallet: (username, password) => ipcRenderer.invoke('load-wallet', username, password),
  registerOnServer: () => ipcRenderer.invoke('register-on-server'),
  getWalletInfo: () => ipcRenderer.invoke('get-wallet-info'),
  sendTransaction: (receiver, amount) => ipcRenderer.invoke('send-transaction', receiver, amount),
  startMining: () => ipcRenderer.invoke('start-mining'),
  stopMining: () => ipcRenderer.invoke('stop-mining'),
  castVote: (voteValue) => ipcRenderer.invoke('cast-vote', voteValue),
  getBlockchain: () => ipcRenderer.invoke('get-blockchain'),
  getBlockDetails: (index) => ipcRenderer.invoke('get-block-details', index),
  getTransactionHistory: () => ipcRenderer.invoke('get-transaction-history'),
  generateQRCode: () => ipcRenderer.invoke('generate-qr-code'),
  getNetworkStats: () => ipcRenderer.invoke('get-network-stats'),
  getMinerStats: () => ipcRenderer.invoke('get-miner-stats'),
  onBlockMined: (callback) => ipcRenderer.on('block-mined', (event, data) => callback(data)),
  onBlockReceived: (callback) => ipcRenderer.on('block-received', (event, data) => callback(data))
});
