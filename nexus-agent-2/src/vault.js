const fs = require('fs');
const path = require('path');

const VAULT_DIR = process.env.VAULT_PATH || '/data/vault';

function ensureVault() {
  if (!fs.existsSync(VAULT_DIR)) fs.mkdirSync(VAULT_DIR, { recursive: true });
}

function vaultWrite(filename, data) {
  ensureVault();
  const safe = filename.replace(/[^a-z0-9_\-\.]/gi, '_');
  const fullPath = path.join(VAULT_DIR, safe);
  const entry = {
    savedAt: new Date().toISOString(),
    data
  };
  fs.writeFileSync(fullPath, JSON.stringify(entry, null, 2));
  return safe;
}

function vaultRead(filename) {
  ensureVault();
  const safe = filename.replace(/[^a-z0-9_\-\.]/gi, '_');
  const fullPath = path.join(VAULT_DIR, safe);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function vaultList() {
  ensureVault();
  return fs.readdirSync(VAULT_DIR)
    .filter(f => !f.startsWith('.'))
    .map(f => {
      const stat = fs.statSync(path.join(VAULT_DIR, f));
      return { filename: f, size: stat.size, modified: stat.mtime };
    })
    .sort((a, b) => new Date(b.modified) - new Date(a.modified));
}

module.exports = { vaultWrite, vaultRead, vaultList };
