const { Blockchain, Block, Transaction } = require('./blockchain');
const { Wallet } = require('./wallet');
const { Miner } = require('./miner');
const fs = require('fs');

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║              V-BLOCKCHAIN TEST SUITE v1.0                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let testsRun = 0;
let testsPassed = 0;

function assert(condition, testName) {
  testsRun++;
  if (condition) {
    console.log(`✓ ${testName}`);
    testsPassed++;
  } else {
    console.log(`✗ ${testName}`);
  }
}

function section(name) {
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`  ${name}`);
  console.log(`────────────────────────────────────────────────────────────`);
}

section('BLOCKCHAIN CORE TESTS');

const blockchain = new Blockchain('TEST_NODE');
assert(blockchain.chain.length === 1, 'Genesis block created');
assert(blockchain.chain[0].index === 0, 'Genesis block has index 0');

section('TRANSACTION TESTS');

const wallet1 = new Wallet('user1');
wallet1.generateKeys();

const wallet2 = new Wallet('user2');
wallet2.generateKeys();

const tx1 = new Transaction(wallet1.address, wallet2.address, 10);
tx1.sign(wallet1.privateKey);
tx1.publicKey = wallet1.publicKey;

assert(tx1.isValid(wallet1.publicKey), 'Transaction signature is valid');

const blockchain2 = new Blockchain('NODE2');
const addTxResult = blockchain2.addTransaction(tx1);
assert(addTxResult === true, 'Valid transaction added to blockchain');
assert(blockchain2.pendingTransactions.length === 1, 'Transaction in pending pool');

section('MINING TESTS');

const beforeBalance = blockchain2.getBalance(wallet1.address);
blockchain2.minePendingTransactions(wallet1.address);
const afterBalance = blockchain2.getBalance(wallet1.address);

assert(blockchain2.chain.length === 2, 'New block added to chain');
assert(afterBalance === beforeBalance + 10 - 10, 'Miner received 10V reward (net after sending tx)');
assert(blockchain2.chain[1].miner === wallet1.address, 'Correct miner address recorded');

section('PROOF OF VOTE TESTS');

const block = blockchain2.getLatestBlock();
assert(block.votes !== undefined, 'Block has votes object');

blockchain2.addVoteToLatestBlock(wallet1.address, true);
const votePercentage = block.getVotePercentage();
assert(votePercentage > 0, 'Vote percentage calculated');

blockchain2.addVoteToLatestBlock(wallet2.address, true);
const updatedPercentage = block.getVotePercentage();
assert(updatedPercentage >= votePercentage, 'Vote percentage updated');

assert(blockchain2.isVoteApprovedForLatestBlock(), 'Block approved by vote');

section('BLOCKCHAIN VALIDATION TESTS');

assert(blockchain2.isChainValid(), 'Valid blockchain passes validation');

const invalidTx = new Transaction(wallet1.address, wallet2.address, 999);
invalidTx.sign(wallet1.privateKey);
invalidTx.publicKey = wallet1.publicKey;

const blockchain3 = new Blockchain('NODE3');
blockchain3.addTransaction(invalidTx);
blockchain3.minePendingTransactions(wallet1.address);

const chain3Valid = blockchain3.isChainValid();
assert(chain3Valid === true, 'Chain with pending transactions validates correctly');

section('WALLET TESTS');

const wallet3 = new Wallet('testuser');
wallet3.generateKeys();

assert(wallet3.publicKey !== null, 'Public key generated');
assert(wallet3.privateKey !== null, 'Private key generated');
assert(wallet3.address.startsWith('V'), 'Address starts with V');
assert(wallet3.balance === 50, 'Welcome bonus is 50 V');

const filename = wallet3.saveToFile('test_wallet.json');
assert(fs.existsSync(filename), 'Wallet file saved');

const loadedWallet = Wallet.loadFromFile(filename);
assert(loadedWallet.address === wallet3.address, 'Wallet loaded correctly');
assert(loadedWallet.balance === 50, 'Wallet balance preserved');

fs.unlinkSync(filename);

section('BALANCE CALCULATION TESTS');

const blockchain4 = new Blockchain('NODE4');
const balanceWallet1 = new Wallet('balance_user1');
balanceWallet1.generateKeys();
const balanceWallet2 = new Wallet('balance_user2');
balanceWallet2.generateKeys();

const tx2 = new Transaction('SYSTEM', balanceWallet1.address, 100);
blockchain4.addTransaction(tx2);
blockchain4.minePendingTransactions(balanceWallet1.address);

let balance1 = blockchain4.getBalance(balanceWallet1.address);
assert(balance1 >= 100, 'User1 received initial transaction');

const tx3 = new Transaction(balanceWallet1.address, balanceWallet2.address, 30);
tx3.sign(balanceWallet1.privateKey);
tx3.publicKey = balanceWallet1.publicKey;
blockchain4.addTransaction(tx3);
blockchain4.minePendingTransactions(balanceWallet1.address);

let newBalance1 = blockchain4.getBalance(balanceWallet1.address);
assert(newBalance1 === balance1 - 30 + 10, 'User1 balance decreased after sending (minus tx, plus reward)');

let balance2 = blockchain4.getBalance(balanceWallet2.address);
assert(balance2 === 30, 'User2 received transaction');

section('MINER TESTS');

const blockchain5 = new Blockchain('MINER_TEST');
const minerWallet = new Wallet('miner');
minerWallet.generateKeys();

const miner = new Miner(minerWallet.address, blockchain5, null);
const stats = miner.getBlockchainStats();

assert(stats.minerAddress === minerWallet.address, 'Miner stats contain correct address');
assert(stats.chainLength === 1, 'Initial chain length is 1');
assert(stats.isChainValid === true, 'Initial chain is valid');

section('CONSENSUS THRESHOLD TESTS');

const blockchain6 = new Blockchain('CONSENSUS_TEST');
blockchain6.voteThreshold = 50;

const consensusBlock = blockchain6.getLatestBlock();
consensusBlock.addVote('voter1', true);
consensusBlock.addVote('voter2', false);

const consensusVotes = consensusBlock.getVotePercentage();
assert(consensusVotes === 50, 'Vote percentage calculation correct');

const consensusApproved = consensusBlock.isVoteApproved(50);
assert(consensusApproved === true, 'Block approved at threshold');

section('CHAIN INTEGRITY TESTS');

const blockchain7 = new Blockchain('INTEGRITY_TEST');

const tx4 = new Transaction('SENDER', 'RECEIVER', 25);
blockchain7.addTransaction(tx4);
blockchain7.minePendingTransactions('MINER1');

const block1Hash = blockchain7.chain[1].calculateHash();
const block1PrevHash = blockchain7.chain[1].previousHash;

assert(block1PrevHash === blockchain7.chain[0].calculateHash(), 'Previous hash links correct');

section('ADDRESS REGISTRY TESTS');

const blockchain8 = new Blockchain('ADDRESS_TEST');
const wallet4 = new Wallet('alice');
wallet4.generateKeys();

const tx5 = new Transaction('SYSTEM', wallet4.address, 50);
blockchain8.addTransaction(tx5);
blockchain8.minePendingTransactions(wallet4.address);

const allAddresses = blockchain8.getAllAddresses();
assert(allAddresses.includes(wallet4.address), 'Address registered in blockchain');
assert(allAddresses.includes('SYSTEM'), 'System address in registry');

section('RESULTS');

console.log(`\n✓ Tests Passed: ${testsPassed}/${testsRun}`);
console.log(`✓ Success Rate: ${((testsPassed / testsRun) * 100).toFixed(2)}%`);

if (testsPassed === testsRun) {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              ALL TESTS PASSED! ✓                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  process.exit(0);
} else {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           SOME TESTS FAILED - CHECK OUTPUT                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  process.exit(1);
}
