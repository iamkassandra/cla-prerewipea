require('dotenv').config();
const express = require('express');
const expressWs = require('express-ws');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { runAgentChat } = require('./src/agent');
const { parseChromeSQLite, parseFirefoxSQLite, parsePasswordCSV } = require('./src/parser');
const { vaultWrite, vaultList, vaultRead } = require('./src/vault');
const { addLog, getLogs, wsClients } = require('./src/logger');
const { getQueue, updateAccount, addAccountsToQueue } = require('./src/queue');

const app = express();
expressWs(app);

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ dest: '/tmp/nexus-uploads/' });

// ── WebSocket live log feed ──────────────────────────────────────────────────
app.ws('/ws/logs', (ws) => {
  wsClients.add(ws);
  ws.send(JSON.stringify({ type: 'history', logs: getLogs() }));
  ws.on('close', () => wsClients.delete(ws));
});

// ── Agent chat ───────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'messages required' });
  try {
    addLog('info', `Chat message received`);
    const reply = await runAgentChat(messages, getQueue());
    addLog('ok', `Agent reply sent`);
    res.json({ reply });
  } catch (e) {
    addLog('err', `Agent error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ── Account queue ────────────────────────────────────────────────────────────
app.get('/api/queue', (req, res) => res.json(getQueue()));

app.patch('/api/queue/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  updateAccount(id, updates);
  addLog('info', `Account ${id} updated: ${JSON.stringify(updates)}`);
  res.json({ ok: true });
});

// ── Browser history upload + parse ──────────────────────────────────────────
app.post('/api/import/chrome', upload.single('file'), async (req, res) => {
  try {
    addLog('info', `Chrome history file received — parsing...`);
    const accounts = await parseChromeSQLite(req.file.path);
    addAccountsToQueue(accounts);
    addLog('ok', `Chrome: ${accounts.length} accounts extracted and queued`);
    res.json({ count: accounts.length, accounts });
  } catch (e) {
    addLog('err', `Chrome parse error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/firefox', upload.single('file'), async (req, res) => {
  try {
    addLog('info', `Firefox places.sqlite received — parsing...`);
    const accounts = await parseFirefoxSQLite(req.file.path);
    addAccountsToQueue(accounts);
    addLog('ok', `Firefox: ${accounts.length} accounts extracted and queued`);
    res.json({ count: accounts.length, accounts });
  } catch (e) {
    addLog('err', `Firefox parse error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/import/passwords', upload.single('file'), async (req, res) => {
  try {
    const source = req.body.source || 'unknown';
    addLog('info', `Password export received from ${source} — parsing...`);
    const entries = await parsePasswordCSV(req.file.path, source);
    addLog('ok', `${source}: ${entries.length} credentials imported`);
    res.json({ count: entries.length });
  } catch (e) {
    addLog('err', `Password parse error: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// ── Vault ────────────────────────────────────────────────────────────────────
app.get('/api/vault', (req, res) => res.json(vaultList()));

app.get('/api/vault/:filename', (req, res) => {
  const data = vaultRead(req.params.filename);
  if (!data) return res.status(404).json({ error: 'not found' });
  res.json(data);
});

app.post('/api/vault', (req, res) => {
  const { filename, data } = req.body;
  vaultWrite(filename, data);
  addLog('ok', `Vault write: ${filename}`);
  res.json({ ok: true });
});

// ── Logs ─────────────────────────────────────────────────────────────────────
app.get('/api/logs', (req, res) => res.json(getLogs()));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', agent: 'NEXUS-1', ts: Date.now() }));

// ── Serve dashboard ──────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  addLog('ok', `NEXUS-1 online — port ${PORT}`);
  console.log(`NEXUS-1 running on :${PORT}`);
});
