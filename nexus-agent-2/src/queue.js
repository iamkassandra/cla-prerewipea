const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(process.env.VAULT_PATH || '/data/vault', 'queue.json');

let queue = [];

// Load persisted queue on startup
function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      console.log(`Queue loaded: ${queue.length} accounts`);
    }
  } catch (e) {
    console.error('Queue load error:', e.message);
    queue = [];
  }
}

function saveQueue() {
  try {
    const dir = path.dirname(QUEUE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // Never persist raw passwords to disk — strip before saving
    const safe = queue.map(a => ({ ...a, pass: a.pass ? '••••••••' : '' }));
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(safe, null, 2));
  } catch (e) {
    console.error('Queue save error:', e.message);
  }
}

function getQueue() { return queue; }

function addAccountsToQueue(accounts) {
  for (const a of accounts) {
    const exists = queue.find(q => q.domain === a.domain);
    if (!exists) queue.push(a);
  }
  saveQueue();
}

function updateAccount(id, updates) {
  const idx = queue.findIndex(a => a.id === id);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...updates };
  saveQueue();
}

function getAccount(id) { return queue.find(a => a.id === id); }

loadQueue();

module.exports = { getQueue, addAccountsToQueue, updateAccount, getAccount };
