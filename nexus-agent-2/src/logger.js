const wsClients = new Set();
const logs = [];
const MAX_LOGS = 500;

function addLog(type, msg) {
  const entry = {
    t: new Date().toTimeString().slice(0, 8),
    ts: Date.now(),
    type,
    msg
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();

  const payload = JSON.stringify({ type: 'log', entry });
  for (const ws of wsClients) {
    try { ws.send(payload); } catch (_) { wsClients.delete(ws); }
  }
}

function getLogs() { return logs; }

module.exports = { addLog, getLogs, wsClients };
