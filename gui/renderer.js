let currentWallet = null;
let isMining = false;
let blocksMined = 0;

const tabs = {
    wallet: document.getElementById('wallet-tab'),
    mining: document.getElementById('mining-tab'),
    transactions: document.getElementById('transactions-tab'),
    blockchain: document.getElementById('blockchain-tab'),
    network: document.getElementById('network-tab'),
    voting: document.getElementById('voting-tab')
};

function switchTab(tabName) {
    Object.values(tabs).forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    tabs[tabName].classList.add('active');
    event.target.classList.add('active');
}

function showMessage(elementId, message, type = 'info') {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message show ${type}`;
    setTimeout(() => messageEl.classList.remove('show'), 5000);
}

function logMining(message, type = 'info') {
    const logBox = document.getElementById('mining-log');
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logBox.appendChild(entry);
    logBox.scrollTop = logBox.scrollHeight;
}

async function updateWalletDisplay() {
    const result = await window.blockchain.getWalletInfo();
    if (result.success) {
        document.getElementById('wallet-username').textContent = result.wallet.username;
        document.getElementById('wallet-address').textContent = result.wallet.address;
        document.getElementById('wallet-balance').textContent = result.wallet.balance + ' V';
        document.getElementById('wallet-created').textContent = result.wallet.createdAt;
        document.getElementById('balance-display').textContent = result.wallet.balance + ' V';
        document.getElementById('node-status').className = 'status-badge online';
        document.getElementById('node-status').textContent = 'Online';
    }
}

async function updateBlockchainDisplay() {
    const result = await window.blockchain.getBlockchain();
    if (result.success) {
        document.getElementById('chain-length').textContent = result.chain.length;
        document.getElementById('chain-valid').textContent = result.isValid ? '✓ Valid' : '✗ Invalid';
        document.getElementById('pending-count').textContent = result.chain[result.chain.length - 1]?.transactions?.length || 0;

        const blocksContainer = document.getElementById('blocks-container');
        blocksContainer.innerHTML = '';

        result.chain.reverse().forEach((block, idx) => {
            const blockEl = document.createElement('div');
            blockEl.className = 'block-card';
            blockEl.innerHTML = `
                <h4>Block #${block.index}</h4>
                <div class="info-row">
                    <span class="label">Hash:</span>
                    <span class="value mono">${block.hash.substring(0, 16)}...</span>
                </div>
                <div class="info-row">
                    <span class="label">Miner:</span>
                    <span class="value mono">${block.miner.substring(0, 16)}...</span>
                </div>
                <div class="info-row">
                    <span class="label">Transactions:</span>
                    <span class="value">${block.transactions}</span>
                </div>
                <div class="info-row">
                    <span class="label">Votes:</span>
                    <span class="value">${block.votes} (${block.votePercentage}%)</span>
                </div>
                <div class="info-row">
                    <span class="label">Timestamp:</span>
                    <span class="value">${block.timestamp}</span>
                </div>
            `;
            blockEl.onclick = () => showBlockDetails(block.index);
            blocksContainer.appendChild(blockEl);
        });
    }
}

async function showBlockDetails(blockIndex) {
    const result = await window.blockchain.getBlockDetails(blockIndex);
    if (result.success) {
        const block = result.block;
        alert(`Block #${block.index}\n\nHash: ${block.hash}\nMiner: ${block.miner}\nTransactions: ${block.transactions.length}\nVotes: ${Object.keys(block.votes).length} (${block.votePercentage}%)\nTimestamp: ${block.timestamp}`);
    }
}

async function updateTransactionHistory() {
    const result = await window.blockchain.getTransactionHistory();
    if (result.success) {
        const txHistory = document.getElementById('tx-history');
        txHistory.innerHTML = '';

        if (result.history.length === 0) {
            txHistory.innerHTML = '<p>No transactions yet</p>';
            return;
        }

        result.history.forEach(tx => {
            const txEl = document.createElement('div');
            txEl.className = `tx-item ${tx.type}`;
            txEl.innerHTML = `
                <div class="tx-header">
                    <span class="type">${tx.type === 'sent' ? '📤 Sent' : '📥 Received'}</span>
                    <span class="amount">${tx.type === 'sent' ? '-' : '+'}${tx.amount} V</span>
                </div>
                <div class="tx-details">
                    <div>${tx.type === 'sent' ? 'To: ' : 'From: '}${tx.type === 'sent' ? tx.receiver : tx.sender}</div>
                    <div>${tx.timestamp}</div>
                </div>
            `;
            txHistory.appendChild(txEl);
        });
    }
}

async function updateNetworkStats() {
    try {
        const result = await window.blockchain.getNetworkStats();
        if (result.success) {
            document.getElementById('total-nodes').textContent = result.stats.totalNodes;
            document.getElementById('active-nodes').textContent = result.stats.activeNodes;
            document.getElementById('total-addresses').textContent = result.stats.totalAddresses;
            document.getElementById('total-v').textContent = result.stats.totalV;
        }
    } catch (error) {
        console.error('Error fetching network stats:', error);
    }
}

async function updateVotingDisplay() {
    const result = await window.blockchain.getBlockchain();
    if (result.success && result.chain.length > 0) {
        const latestBlock = result.chain[result.chain.length - 1];
        document.getElementById('latest-block').textContent = `#${latestBlock.index}`;
        document.getElementById('vote-count').textContent = latestBlock.votes;
        document.getElementById('approval-percentage').textContent = latestBlock.votePercentage + '%';
    }
}

async function updateMinerStats() {
    const result = await window.blockchain.getMinerStats();
    if (result.success) {
        document.getElementById('blocks-mined').textContent = blocksMined;
    }
}

// Event Listeners
document.getElementById('create-wallet-btn').addEventListener('click', async () => {
    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    if (!username) {
        showMessage('login-message', 'Please enter a username', 'error');
        return;
    }
    if (!password) {
        showMessage('login-message', 'Please enter a password', 'error');
        return;
    }

    const result = await window.blockchain.createWallet(username, password);
    if (result.success) {
        currentWallet = result.wallet;
        showLoginPanel(false);
        await registerOnServer();
    } else {
        showMessage('login-message', result.error, 'error');
    }
});

document.getElementById('load-wallet-btn').addEventListener('click', async () => {
    const username = document.getElementById('username-input').value;
    const password = document.getElementById('password-input').value;
    if (!username) {
        showMessage('login-message', 'Please enter a username', 'error');
        return;
    }
    if (!password) {
        showMessage('login-message', 'Please enter a password', 'error');
        return;
    }

    const result = await window.blockchain.loadWallet(username, password);
    if (result.success) {
        currentWallet = result.wallet;
        showLoginPanel(false);
        await updateWalletDisplay();
    } else {
        showMessage('login-message', result.error, 'error');
    }
});

async function registerOnServer() {
    const result = await window.blockchain.registerOnServer();
    if (result.success) {
        await updateWalletDisplay();
    }
}

function showLoginPanel(show) {
    document.getElementById('login-panel').classList.toggle('active', show);
    document.getElementById('dashboard').style.display = show ? 'none' : 'flex';
    if (!show) {
        updateWalletDisplay();
    }
}

// Wallet Tab
document.getElementById('refresh-wallet-btn').addEventListener('click', updateWalletDisplay);

document.getElementById('copy-address-btn').addEventListener('click', () => {
    const address = document.getElementById('wallet-address').textContent;
    if (address && address !== '--') {
        navigator.clipboard.writeText(address).then(() => {
            showMessage('login-message', 'Address copied to clipboard!', 'success');
        }).catch(() => {
            showMessage('login-message', 'Failed to copy address', 'error');
        });
    }
});

document.getElementById('generate-qr-btn').addEventListener('click', async () => {
    const result = await window.blockchain.generateQRCode();
    if (result.success) {
        const qrContainer = document.getElementById('qr-container');
        const qrDisplay = document.getElementById('qr-display');
        const filePath = result.path.replace(/\\/g, '/');
        qrDisplay.innerHTML = `<img src="file:///${filePath}" alt="QR Code" style="max-width: 300px; border: 1px solid #ccc; border-radius: 8px;">`;
        qrContainer.style.display = 'block';
        showMessage('qr-message', `QR Code saved to: ${result.path}`, 'success');
    } else {
        showMessage('qr-message', `Failed to generate QR code: ${result.error}`, 'error');
    }
});

// Mining Tab
document.getElementById('start-mining-btn').addEventListener('click', async () => {
    const result = await window.blockchain.startMining();
    if (result.success) {
        isMining = true;
        document.getElementById('mining-status').textContent = 'Running';
        document.getElementById('start-mining-btn').disabled = true;
        document.getElementById('stop-mining-btn').disabled = false;
        logMining('Mining started', 'success');
    } else {
        logMining('Failed to start mining: ' + result.error, 'error');
    }
});

document.getElementById('stop-mining-btn').addEventListener('click', async () => {
    const result = await window.blockchain.stopMining();
    if (result.success) {
        isMining = false;
        document.getElementById('mining-status').textContent = 'Stopped';
        document.getElementById('start-mining-btn').disabled = false;
        document.getElementById('stop-mining-btn').disabled = true;
        logMining('Mining stopped', 'success');
    }
});

window.blockchain.onBlockMined((data) => {
    blocksMined++;
    logMining(`Block #${data.index} mined! (${data.transactions} txs)`, 'success');
    document.getElementById('blocks-mined').textContent = blocksMined;
    updateBlockchainDisplay();
    updateWalletDisplay();
    updateTransactionHistory();
});

window.blockchain.onBlockReceived((data) => {
    console.log('New block received from network');
    updateWalletDisplay();
    updateBlockchainDisplay();
    updateTransactionHistory();
});

// Transactions Tab
document.getElementById('send-tx-btn').addEventListener('click', async () => {
    const receiver = document.getElementById('receiver-input').value;
    const amount = parseFloat(document.getElementById('amount-input').value);

    if (!receiver || !amount) {
        showMessage('tx-message', 'Please fill in all fields', 'error');
        return;
    }

    const result = await window.blockchain.sendTransaction(receiver, amount);
    if (result.success) {
        showMessage('tx-message', 'Transaction sent! (Waiting for mining)', 'success');
        document.getElementById('receiver-input').value = '';
        document.getElementById('amount-input').value = '';
        updateTransactionHistory();
    } else {
        showMessage('tx-message', result.error, 'error');
    }
});

// Blockchain Tab
document.getElementById('refresh-chain-btn').addEventListener('click', updateBlockchainDisplay);

// Network Tab
document.getElementById('refresh-network-btn').addEventListener('click', async () => {
    await updateNetworkStats();
    const result = await window.blockchain.getMinerStats();
    if (result.success) {
        const nodeInfo = document.getElementById('node-info');
        const stats = result.stats;
        nodeInfo.innerHTML = `
            <div class="info-row">
                <span class="label">Chain Length:</span>
                <span class="value">${stats.chainLength}</span>
            </div>
            <div class="info-row">
                <span class="label">Balance:</span>
                <span class="value">${stats.balance} V</span>
            </div>
            <div class="info-row">
                <span class="label">Pending Transactions:</span>
                <span class="value">${stats.pendingTransactions}</span>
            </div>
            <div class="info-row">
                <span class="label">Chain Valid:</span>
                <span class="value">${stats.isChainValid ? '✓ Yes' : '✗ No'}</span>
            </div>
            <div class="info-row">
                <span class="label">Threshold:</span>
                <span class="value">${stats.voteThreshold}</span>
            </div>
        `;
    }
});

// Voting Tab
document.getElementById('vote-yes-btn').addEventListener('click', async () => {
    const result = await window.blockchain.castVote(true);
    if (result.success) {
        const message = `Vote recorded! Approval: ${result.percentage}%`;
        document.getElementById('vote-result').textContent = message;
        document.getElementById('vote-result').className = 'message show success';
        updateVotingDisplay();
    } else {
        showMessage('vote-result', result.error, 'error');
    }
});

document.getElementById('vote-no-btn').addEventListener('click', async () => {
    const result = await window.blockchain.castVote(false);
    if (result.success) {
        const message = `Vote recorded! Approval: ${result.percentage}%`;
        document.getElementById('vote-result').textContent = message;
        document.getElementById('vote-result').className = 'message show success';
        updateVotingDisplay();
    } else {
        showMessage('vote-result', result.error, 'error');
    }
});

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        switchTab(tabName);

        // Update data when tab is opened
        if (tabName === 'wallet') updateWalletDisplay();
        if (tabName === 'transactions') updateTransactionHistory();
        if (tabName === 'blockchain') updateBlockchainDisplay();
        if (tabName === 'network') updateNetworkStats();
        if (tabName === 'voting') updateVotingDisplay();
    });
});

// Check server health
async function checkServerHealth() {
    try {
        const result = await window.blockchain.getNetworkStats();
        if (result.success) {
            document.getElementById('node-status').className = 'status-badge online';
            document.getElementById('node-status').textContent = 'Online';
        }
    } catch (error) {
        document.getElementById('node-status').className = 'status-badge offline';
        document.getElementById('node-status').textContent = 'Offline';
    }
}

// Auto-update on interval
setInterval(() => {
    checkServerHealth();
    if (isMining) {
        updateBlockchainDisplay();
        updateVotingDisplay();
    }
}, 3000);

// Logout Button
document.getElementById('logout-btn').addEventListener('click', () => {
    currentWallet = null;
    blocksMined = 0;
    isMining = false;
    document.getElementById('username-input').value = '';
    document.getElementById('password-input').value = '';
    document.getElementById('mining-log').innerHTML = '<p class="log-entry">Mining log will appear here...</p>';
    showLoginPanel(true);
    showMessage('login-message', 'Logged out successfully', 'success');
});

// Initial load
checkServerHealth();
updateWalletDisplay();
