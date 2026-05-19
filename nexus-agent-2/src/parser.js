const Database = require('better-sqlite3');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Known platforms extracted from domain names
const PLATFORM_MAP = {
  'reddit.com': 'Reddit', 'twitter.com': 'Twitter/X', 'x.com': 'Twitter/X',
  'instagram.com': 'Instagram', 'facebook.com': 'Facebook', 'linkedin.com': 'LinkedIn',
  'github.com': 'GitHub', 'gitlab.com': 'GitLab', 'dropbox.com': 'Dropbox',
  'drive.google.com': 'Google Drive', 'notion.so': 'Notion', 'medium.com': 'Medium',
  'substack.com': 'Substack', 'patreon.com': 'Patreon', 'spotify.com': 'Spotify',
  'soundcloud.com': 'SoundCloud', 'youtube.com': 'YouTube', 'vimeo.com': 'Vimeo',
  'behance.net': 'Behance', 'dribbble.com': 'Dribbble', 'pinterest.com': 'Pinterest',
  'tumblr.com': 'Tumblr', 'wordpress.com': 'WordPress', 'etsy.com': 'Etsy',
  'ebay.com': 'eBay', 'amazon.com': 'Amazon', 'paypal.com': 'PayPal',
  'twitch.tv': 'Twitch', 'discord.com': 'Discord', 'slack.com': 'Slack',
  'trello.com': 'Trello', 'asana.com': 'Asana', 'figma.com': 'Figma',
  'canva.com': 'Canva', 'mailchimp.com': 'Mailchimp', 'hubspot.com': 'HubSpot',
};

function domainToName(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PLATFORM_MAP[host] || host;
  } catch { return url; }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
}

// Chrome: History file is SQLite at ~/Library/Application Support/Google/Chrome/Default/History
async function parseChromeSQLite(filePath) {
  const db = new Database(filePath, { readonly: true });
  const rows = db.prepare(`
    SELECT DISTINCT url, title, visit_count, last_visit_time
    FROM urls
    WHERE url NOT LIKE 'chrome%'
      AND url NOT LIKE 'about%'
      AND url NOT LIKE 'data%'
    ORDER BY visit_count DESC
    LIMIT 5000
  `).all();
  db.close();

  return deduplicateByDomain(rows.map(r => ({
    id: uuidv4(),
    platform: domainToName(r.url),
    domain: extractDomain(r.url),
    url: r.url,
    title: r.title,
    visitCount: r.visit_count,
    source: 'Chrome · History',
    status: 'pending',
    user: '',
    pass: '',
    email: '',
    data: `${r.visit_count} visits`,
    action: 'review',
    expanded: false,
  })));
}

// Firefox: places.sqlite at ~/Library/Application Support/Firefox/Profiles/*/places.sqlite
async function parseFirefoxSQLite(filePath) {
  const db = new Database(filePath, { readonly: true });
  const rows = db.prepare(`
    SELECT DISTINCT p.url, p.title, p.visit_count, p.last_visit_date
    FROM moz_places p
    WHERE p.url NOT LIKE 'about%'
      AND p.url NOT LIKE 'data%'
      AND p.url NOT LIKE 'place%'
      AND p.visit_count > 0
    ORDER BY p.visit_count DESC
    LIMIT 5000
  `).all();
  db.close();

  return deduplicateByDomain(rows.map(r => ({
    id: uuidv4(),
    platform: domainToName(r.url),
    domain: extractDomain(r.url),
    url: r.url,
    title: r.title,
    visitCount: r.visit_count,
    source: 'Firefox · History',
    status: 'pending',
    user: '',
    pass: '',
    email: '',
    data: `${r.visit_count} visits`,
    action: 'review',
    expanded: false,
  })));
}

// Password CSV — works with Chrome, Firefox, Bitwarden, 1Password, Dashlane exports
async function parsePasswordCSV(filePath, source) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  return records.map(r => {
    // Normalise across different export formats
    const url = r.url || r.URL || r.login_uri || r.Website || r.web_site || '';
    const user = r.username || r.Username || r.login_username || r.User || '';
    const pass = r.password || r.Password || r.login_password || '';
    const name = r.name || r.Name || r.title || domainToName(url) || 'Unknown';
    const email = r.email || r.Email || '';

    return {
      id: uuidv4(),
      platform: name,
      domain: extractDomain(url),
      url,
      source: `${source} · Passwords`,
      status: 'pending',
      user,
      pass,       // stored in memory only, written to vault on approval
      email,
      data: 'Credentials found',
      action: 'review',
      expanded: false,
    };
  }).filter(r => r.domain);
}

// Collapse multiple URLs for the same domain into one queue entry
function deduplicateByDomain(entries) {
  const seen = new Map();
  for (const e of entries) {
    if (!e.domain) continue;
    if (!seen.has(e.domain)) {
      seen.set(e.domain, e);
    } else {
      const ex = seen.get(e.domain);
      ex.visitCount = (ex.visitCount || 0) + (e.visitCount || 0);
      ex.data = `${ex.visitCount} visits`;
    }
  }
  return [...seen.values()];
}

module.exports = { parseChromeSQLite, parseFirefoxSQLite, parsePasswordCSV };
