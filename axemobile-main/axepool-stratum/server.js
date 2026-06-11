/**
 * AxePool Stats API
 * Exposes real-time pool statistics from ckpool via HTTP
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.STATS_PORT || 3334;
const CKPOOL_DIR = process.env.CKPOOL_DIR || '/var/run/ckpool';
const DATA_DIR = process.env.DATA_DIR || '/data/ckpool';

app.use(cors());
app.use(express.json());

// In-memory storage for real-time tracking
let poolData = {
  miners: {},
  blocks: [],
  totalShares: 0,
  totalHashrate: 0,
  startTime: Date.now(),
  hashrateHistory: [],
  sharesHistory: []
};

// Load persisted data
const dataFile = path.join(DATA_DIR, 'pooldata.json');
try {
  if (fs.existsSync(dataFile)) {
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    poolData = { ...poolData, ...saved };
  }
} catch (e) {
  console.log('Starting with fresh pool data');
}

// Save data periodically
setInterval(() => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify({
      blocks: poolData.blocks,
      totalShares: poolData.totalShares,
      startTime: poolData.startTime
    }));
  } catch (e) {
    console.error('Failed to save pool data:', e);
  }
}, 60000);

// Read ckpool stats files
function readCkpoolStats() {
  try {
    const statsPath = path.join(CKPOOL_DIR, 'pool', 'pool.status');
    if (fs.existsSync(statsPath)) {
      return JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    }
  } catch (e) {
    console.log('No ckpool stats available');
  }
  return null;
}

// Read connected users from ckpool
function readCkpoolUsers() {
  const users = [];
  try {
    const usersDir = path.join(CKPOOL_DIR, 'users');
    if (fs.existsSync(usersDir)) {
      const files = fs.readdirSync(usersDir);
      for (const file of files) {
        if (file.endsWith('.status')) {
          const data = JSON.parse(fs.readFileSync(path.join(usersDir, file), 'utf8'));
          users.push(data);
        }
      }
    }
  } catch (e) {
    console.log('No ckpool users available');
  }
  return users;
}

// Get pool overview
app.get('/api/pool/stats', (req, res) => {
  const ckStats = readCkpoolStats();
  const ckUsers = readCkpoolUsers();

  // Calculate totals from connected miners
  let totalHashrate = 0;
  let activeMiners = 0;
  const minerList = [];

  // From ckpool users
  for (const user of ckUsers) {
    if (user.hashrate1m > 0) {
      activeMiners++;
      totalHashrate += user.hashrate1m;
      minerList.push({
        id: user.workername || user.username,
        address: user.username,
        name: user.workername || user.username,
        hashrate: user.hashrate1m / 1e9, // Convert to GH/s
        shares: user.shares || 0,
        lastSeen: new Date(user.lastshare * 1000),
        active: true
      });
    }
  }

  // Also include tracked miners from share submissions
  for (const [id, miner] of Object.entries(poolData.miners)) {
    if (!minerList.find(m => m.id === id)) {
      const isRecent = (Date.now() - miner.lastSeen) < 120000; // 2 min
      if (isRecent) {
        activeMiners++;
        totalHashrate += miner.hashrate || 0;
        minerList.push({
          id,
          address: miner.address,
          name: miner.name || id,
          hashrate: miner.hashrate,
          shares: miner.shares,
          lastSeen: new Date(miner.lastSeen),
          active: true
        });
      }
    }
  }

  res.json({
    pool: {
      name: 'AxePool',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - poolData.startTime) / 1000),
      stratumPort: 3333
    },
    stats: {
      totalHashrate,
      activeMiners,
      totalShares: poolData.totalShares,
      blocksFound: poolData.blocks.length,
      lastBlockTime: poolData.blocks.length > 0 
        ? poolData.blocks[poolData.blocks.length - 1].time 
        : null,
      difficulty: ckStats?.diff || 1
    },
    miners: minerList
  });
});

// Get hashrate history (last 1 hour, 10s intervals)
app.get('/api/pool/hashrate', (req, res) => {
  res.json({
    history: poolData.hashrateHistory.slice(-360)
  });
});

// Get shares history (last 1 hour, 10s intervals)
app.get('/api/pool/shares', (req, res) => {
  res.json({
    history: poolData.sharesHistory.slice(-360)
  });
});

// Get found blocks
app.get('/api/pool/blocks', (req, res) => {
  res.json({
    blocks: poolData.blocks.slice(-100)
  });
});

// Get connected miners
app.get('/api/pool/miners', (req, res) => {
  const ckUsers = readCkpoolUsers();
  const miners = [];

  for (const user of ckUsers) {
    miners.push({
      id: user.workername || user.username,
      address: user.username,
      name: user.workername || user.username,
      hashrate: user.hashrate1m / 1e9,
      hashrate5m: user.hashrate5m / 1e9,
      shares: user.shares || 0,
      bestDiff: user.bestdiff || 0,
      lastShare: user.lastshare ? new Date(user.lastshare * 1000) : null,
      active: user.hashrate1m > 0
    });
  }

  res.json({ miners });
});

// Submit share (called by ckpool notifier)
app.post('/api/pool/share', (req, res) => {
  const { workername, address, diff, result } = req.body;

  if (result === 'accepted') {
    poolData.totalShares++;

    // Track miner
    const minerId = workername || address;
    if (!poolData.miners[minerId]) {
      poolData.miners[minerId] = {
        address,
        name: workername,
        shares: 0,
        hashrate: 0,
        lastSeen: Date.now()
      };
    }
    poolData.miners[minerId].shares++;
    poolData.miners[minerId].lastSeen = Date.now();
  }

  res.json({ ok: true });
});

// Block found notification (called by ckpool notifier)
app.post('/api/pool/block', (req, res) => {
  const { height, hash, reward, finder } = req.body;

  poolData.blocks.push({
    height,
    hash,
    reward,
    finder,
    time: new Date().toISOString()
  });

  console.log(`🎉 BLOCK FOUND! Height: ${height}, Finder: ${finder}`);

  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Collect stats every 10 seconds
setInterval(() => {
  const ckStats = readCkpoolStats();
  const ckUsers = readCkpoolUsers();

  let totalHashrate = 0;
  let totalNewShares = 0;

  for (const user of ckUsers) {
    totalHashrate += user.hashrate1m || 0;
  }

  const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  poolData.hashrateHistory.push({
    time,
    hashrate: totalHashrate / 1e9, // GH/s
    shares: totalNewShares
  });

  // Keep only last hour
  if (poolData.hashrateHistory.length > 360) {
    poolData.hashrateHistory = poolData.hashrateHistory.slice(-360);
  }

}, 10000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AxePool Stats API running on port ${PORT}`);
});
