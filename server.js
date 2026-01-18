const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

let nodes = [];
let transactions = [];
let addresses = {};

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    name: 'V-Blockchain Network',
    type: 'IP Registry & Boot Node Server',
    version: '1.0',
    status: 'running',
    endpoints: {
      'POST /register-node': 'Register new node',
      'GET /get-peers/:nodeId': 'Get peer list',
      'POST /register-address': 'Register wallet address',
      'GET /get-address-info/:address': 'Get address info',
      'GET /get-all-addresses': 'Get all registered addresses',
      'GET /get-all-nodes': 'Get all registered nodes',
      'POST /heartbeat/:nodeId': 'Update node heartbeat',
      'GET /network-stats': 'Get network statistics',
      'GET /health': 'Server health check'
    }
  });
});

const nodesFile = 'nodes_registry.json';
const addressesFile = 'addresses_registry.json';

const loadRegistry = () => {
  if (fs.existsSync(nodesFile)) {
    nodes = JSON.parse(fs.readFileSync(nodesFile, 'utf8'));
  }
  if (fs.existsSync(addressesFile)) {
    addresses = JSON.parse(fs.readFileSync(addressesFile, 'utf8'));
  }
};

const saveRegistry = () => {
  fs.writeFileSync(nodesFile, JSON.stringify(nodes, null, 2));
  fs.writeFileSync(addressesFile, JSON.stringify(addresses, null, 2));
};

const addWindowsFirewallRule = (port, ruleName = `V-Blockchain-${port}`) => {
  try {
    const inboundRule = `netsh advfirewall firewall add rule name="${ruleName}-IN" dir=in action=allow protocol=tcp localport=${port} enable=yes`;
    const outboundRule = `netsh advfirewall firewall add rule name="${ruleName}-OUT" dir=out action=allow protocol=tcp remoteport=${port} enable=yes`;
    
    try {
      execSync(inboundRule, { stdio: 'pipe' });
      console.log(`✓ Added inbound firewall rule for port ${port}`);
    } catch (e) {
      console.log(`✓ Inbound firewall rule for port ${port} already exists or added`);
    }

    try {
      execSync(outboundRule, { stdio: 'pipe' });
      console.log(`✓ Added outbound firewall rule for port ${port}`);
    } catch (e) {
      console.log(`✓ Outbound firewall rule for port ${port} already exists or added`);
    }
    
    return true;
  } catch (error) {
    console.error(`✗ Failed to add firewall rules: ${error.message}`);
    return false;
  }
};

app.post('/register-node', (req, res) => {
  const { nodeId, host, port, publicKey } = req.body;

  if (!nodeId || !host || !port) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const existingNode = nodes.find(n => n.nodeId === nodeId);
  if (existingNode) {
    return res.status(400).json({ error: 'Node already registered' });
  }

  const node = {
    nodeId,
    host,
    port,
    publicKey,
    registeredAt: Date.now(),
    lastSeen: Date.now()
  };

  nodes.push(node);
  saveRegistry();
  addWindowsFirewallRule(port, `V-Node-${nodeId}`);

  res.json({
    success: true,
    message: 'Node registered successfully',
    peers: nodes.filter(n => n.nodeId !== nodeId)
  });
});

app.get('/get-peers/:nodeId', (req, res) => {
  const { nodeId } = req.params;
  const peers = nodes.filter(n => n.nodeId !== nodeId);
  res.json({ peers });
});

app.post('/register-address', (req, res) => {
  const { address, username, publicKey } = req.body;

  if (!address || !username || !publicKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (addresses[address]) {
    return res.status(400).json({ error: 'Address already registered' });
  }

  addresses[address] = {
    username,
    publicKey,
    registeredAt: Date.now(),
    balance: 50
  };

  saveRegistry();

  res.json({
    success: true,
    message: 'Address registered with 50 V welcome bonus',
    data: addresses[address]
  });
});

app.get('/get-address-info/:address', (req, res) => {
  const { address } = req.params;
  const info = addresses[address];

  if (!info) {
    return res.status(404).json({ error: 'Address not found' });
  }

  res.json(info);
});

app.get('/get-all-addresses', (req, res) => {
  res.json(Object.entries(addresses).map(([address, info]) => ({
    address,
    ...info
  })));
});

app.get('/get-all-nodes', (req, res) => {
  const activeNodes = nodes.map(n => ({
    ...n,
    isActive: Date.now() - n.lastSeen < 60000
  }));
  res.json(activeNodes);
});

app.post('/heartbeat/:nodeId', (req, res) => {
  const { nodeId } = req.params;
  const node = nodes.find(n => n.nodeId === nodeId);

  if (node) {
    node.lastSeen = Date.now();
    saveRegistry();
  }

  res.json({ success: true });
});

app.get('/network-stats', (req, res) => {
  res.json({
    totalNodes: nodes.length,
    totalAddresses: Object.keys(addresses).length,
    totalV: Object.values(addresses).reduce((sum, addr) => sum + addr.balance, 0),
    activeNodes: nodes.filter(n => Date.now() - n.lastSeen < 60000).length
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: Date.now(),
    nodes: nodes.length,
    addresses: Object.keys(addresses).length
  });
});

loadRegistry();

const SERVER = app.listen(PORT, 'localhost', () => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║          V-BLOCKCHAIN IP REGISTRY SERVER STARTED           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`Server running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}`);
  console.log('────────────────────────────────────────────────────────────');
  addWindowsFirewallRule(PORT, 'V-Blockchain-Server');
  console.log('────────────────────────────────────────────────────────────');
  console.log('Available endpoints:');
  console.log('  POST   /register-node          - Register new node');
  console.log('  GET    /get-peers/:nodeId      - Get peer list');
  console.log('  POST   /register-address       - Register wallet address');
  console.log('  GET    /get-address-info/:addr - Get address info');
  console.log('  GET    /get-all-addresses      - Get all registered addresses');
  console.log('  GET    /get-all-nodes          - Get all registered nodes');
  console.log('  POST   /heartbeat/:nodeId      - Update node heartbeat');
  console.log('  GET    /network-stats          - Get network statistics');
  console.log('  GET    /health                 - Server health check');
  console.log('════════════════════════════════════════════════════════════\n');
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  SERVER.close();
  process.exit(0);
});
