import fs from 'fs';
import path from 'path';

const HEALTH_FILE = path.join(process.cwd(), 'dist', 'health.json');
const MAX_HISTORY = 672; // 7 days * 24 hours * 4 (every 15 min)

function loadHealth() {
  try {
    if (fs.existsSync(HEALTH_FILE)) {
      return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
    }
  } catch {}
  return { servers: {}, lastUpdate: null };
}

function saveHealth(data) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  data.lastUpdate = new Date().toISOString();
  fs.writeFileSync(HEALTH_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getServerKey(config) {
  return `${config.protocol || 'unknown'}://${config.host}:${config.port}`;
}

function getUptime(history, maxEntries) {
  if (!history || history.length === 0) return 0;
  const recent = history.slice(-maxEntries);
  const aliveCount = recent.filter(h => h.alive).length;
  return Math.round((aliveCount / recent.length) * 100);
}

function getAvgLatency(history, maxEntries) {
  if (!history || history.length === 0) return 0;
  const recent = history.slice(-maxEntries);
  const latencies = recent.filter(h => h.alive && h.latency > 0).map(h => h.latency);
  if (latencies.length === 0) return 0;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

function getConsecutiveFailures(history) {
  if (!history || history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].alive) count++;
    else break;
  }
  return count;
}

export function updateHealth(testedConfigs) {
  const health = loadHealth();
  const timestamp = new Date().toISOString();

  for (const cfg of testedConfigs) {
    const key = getServerKey(cfg);
    if (!health.servers[key]) {
      health.servers[key] = {
        host: cfg.host,
        port: cfg.port,
        protocol: cfg.protocol,
        country: cfg.country,
        firstSeen: timestamp,
        history: [],
      };
    }

    const server = health.servers[key];
    server.lastSeen = timestamp;
    server.country = cfg.country || server.country;
    server.history.push({
      timestamp,
      alive: cfg.alive || false,
      tlsOk: cfg.tlsOk || false,
      latency: cfg.latency || 0,
      score: cfg.score || 0,
    });

    if (server.history.length > MAX_HISTORY) {
      server.history = server.history.slice(-MAX_HISTORY);
    }
  }

  saveHealth(health);
  return health;
}

export function getHealthStats(health) {
  const stats = {
    totalServers: Object.keys(health.servers).length,
    healthyServers: 0,
    unstableServers: 0,
    deadServers: 0,
    avgUptime24h: 0,
    avgUptime7d: 0,
    bestServers: [],
    worstServers: [],
    byCountry: {},
    byProtocol: {},
  };

  const serverStats = [];

  for (const [key, server] of Object.entries(health.servers)) {
    const uptime24h = getUptime(server.history, 96);
    const uptime7d = getUptime(server.history, 672);
    const avgLatency = getAvgLatency(server.history, 96);
    const failures = getConsecutiveFailures(server.history);

    const s = {
      key,
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      country: server.country,
      uptime24h,
      uptime7d,
      avgLatency,
      consecutiveFailures: failures,
      lastSeen: server.lastSeen,
      historyLength: server.history.length,
    };

    serverStats.push(s);

    if (uptime24h >= 80) stats.healthyServers++;
    else if (uptime24h >= 30) stats.unstableServers++;
    else stats.deadServers++;

    const country = server.country || 'Unknown';
    if (!stats.byCountry[country]) stats.byCountry[country] = { total: 0, healthy: 0 };
    stats.byCountry[country].total++;
    if (uptime24h >= 80) stats.byCountry[country].healthy++;

    const proto = server.protocol || 'unknown';
    if (!stats.byProtocol[proto]) stats.byProtocol[proto] = { total: 0, healthy: 0 };
    stats.byProtocol[proto].total++;
    if (uptime24h >= 80) stats.byProtocol[proto].healthy++;
  }

  serverStats.sort((a, b) => b.uptime24h - a.uptime24h || a.avgLatency - b.avgLatency);
  stats.bestServers = serverStats.filter(s => s.uptime24h >= 80).slice(0, 10);
  stats.worstServers = serverStats.filter(s => s.uptime24h < 50 && s.historyLength > 5).slice(-10).reverse();

  const u24 = serverStats.filter(s => s.historyLength > 5).map(s => s.uptime24h);
  const u7d = serverStats.filter(s => s.historyLength > 10).map(s => s.uptime7d);
  stats.avgUptime24h = u24.length > 0 ? Math.round(u24.reduce((a, b) => a + b, 0) / u24.length) : 0;
  stats.avgUptime7d = u7d.length > 0 ? Math.round(u7d.reduce((a, b) => a + b, 0) / u7d.length) : 0;

  return stats;
}

export function getHealthSummary(health) {
  const stats = getHealthStats(health);
  const lines = [
    `📊 آمار سلامت سرورها`,
    ``,
    `🖥 کل سرورها: ${stats.totalServers}`,
    `✅ سالم (آپتایم >80%): ${stats.healthyServers}`,
    `⚠️ ناپایدار (30-80%): ${stats.unstableServers}`,
    `❌ مرده (<30%): ${stats.deadServers}`,
    ``,
    `📈 آپتایم میانگین:`,
    `  ۲۴ ساعت: ${stats.avgUptime24h}%`,
    `  ۷ روز: ${stats.avgUptime7d}%`,
  ];

  if (stats.bestServers.length > 0) {
    lines.push('', '🏆 بهترین سرورها:');
    for (const s of stats.bestServers.slice(0, 5)) {
      lines.push(`  ${s.host}:${s.port} — ${s.uptime24h}% (${s.avgLatency}ms)`);
    }
  }

  return lines.join('\n');
}

export { getServerKey };
