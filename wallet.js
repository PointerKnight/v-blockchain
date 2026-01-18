const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

class Wallet {
  constructor(username, password = null) {
    this.username = username;
    this.password = password ? this.hashPassword(password) : null;
    this.publicKey = null;
    this.privateKey = null;
    this.address = null;
    this.balance = 50;
    this.createdAt = Date.now();
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  verifyPassword(password) {
    if (!this.password) return false;
    return this.hashPassword(password) === this.password;
  }

  generateKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.address = this.generateAddress();
    return {
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      address: this.address
    };
  }

  generateAddress() {
    const hash = crypto
      .createHash('sha256')
      .update(this.publicKey)
      .digest('hex');
    return 'V' + hash.substring(0, 40).toUpperCase();
  }

  saveToFile(filename = `wallet_${this.username}.json`) {
    const walletData = {
      username: this.username,
      password: this.password,
      address: this.address,
      publicKey: this.publicKey,
      privateKey: this.privateKey,
      balance: this.balance,
      createdAt: this.createdAt
    };

    fs.writeFileSync(filename, JSON.stringify(walletData, null, 2));
    return filename;
  }

  static loadFromFile(filename, password = null) {
    const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
    const wallet = new Wallet(data.username, password);
    
    if (!wallet.verifyPassword(password)) {
      throw new Error('Invalid password');
    }
    
    wallet.publicKey = data.publicKey;
    wallet.privateKey = data.privateKey;
    wallet.address = data.address;
    wallet.balance = data.balance;
    wallet.createdAt = data.createdAt;
    wallet.password = data.password;
    return wallet;
  }

  async generateQRCode(outputPath = null) {
    const qrData = {
      address: this.address,
      username: this.username,
      publicKey: this.publicKey.substring(0, 100) + '...'
    };

    const qrString = JSON.stringify(qrData);
    
    if (!outputPath) {
      outputPath = path.join(__dirname, `qr_${this.username}_${Date.now()}.png`);
    }

    await QRCode.toFile(outputPath, qrString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.95,
      margin: 1,
      width: 300
    });

    return outputPath;
  }

  async displayWalletInfo() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      WALLET INFORMATION                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`Username: ${this.username}`);
    console.log(`Address: ${this.address}`);
    console.log(`Balance: ${this.balance} V`);
    console.log(`Created: ${new Date(this.createdAt).toLocaleString()}`);
    console.log('────────────────────────────────────────────────────────────');
    console.log(`Public Key (first 100 chars):\n${this.publicKey.substring(0, 100)}...`);
    console.log('────────────────────────────────────────────────────────────');
  }
}

module.exports = { Wallet };
