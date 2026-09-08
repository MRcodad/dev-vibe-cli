import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const FAILOVER_THRESHOLD = 3; // consecutive failures to trigger failover
const HEALTH_FILE = path.join(process.cwd(), 'dist', 'health.json');

function loadHealth() {
  try {
    if (fs.existsSync(HEALTH_FILE)) {
      return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
    }
  } catch {}
  return { servers: {} };
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

function getServerUptime(history, maxEntries = 96) {
  if (!history || history.length === 0) return 0;
  const recent = history.slice(-maxEntries);
  const aliveCount = recent.filter(h => h.alive).length;
  return Math.round((aliveCount / recent.length) * 100);
}

function getAvgLatency(history, maxEntries = 96) {
  if (!history || history.length === 0) return 0;
  const recent = history.slice(-maxEntries);
  const latencies = recent.filter(h => h.alive && h.latency > 0).map(h => h.latency);
  if (latencies.length === 0) return 0;
  return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
}

export function detectFailingServers() {
  const health = loadHealth();
  const failing = [];
  const healthy = [];

  for (const [key, server] of Object.entries(health.servers)) {
    const failures = getConsecutiveFailures(server.history);
    const uptime = getServerUptime(server.history);
    const avgLatency = getAvgLatency(server.history);

    if (failures >= FAILOVER_THRESHOLD || uptime < 20) {
      failing.push({
        key,
        host: server.host,
        port: server.port,
        protocol: server.protocol,
        country: server.country,
        consecutiveFailures: failures,
        uptime,
        avgLatency,
        lastSeen: server.lastSeen,
      });
    } else if (uptime >= 50) {
      healthy.push({
        key,
        host: server.host,
        port: server.port,
        protocol: server.protocol,
        country: server.country,
        uptime,
        avgLatency,
      });
    }
  }

  // Sort healthy by uptime (best first), then by latency (lowest first)
  healthy.sort((a, b) => b.uptime - a.uptime || a.avgLatency - b.avgLatency);

  return { failing, healthy };
}

export function performFailover(currentConfigs) {
  const { failing, healthy } = detectFailingServers();

  if (failing.length === 0) {
    return {
      changed: false,
      removed: [],
      added: [],
      message: 'همه سرورها سالم هستند.',
    };
  }

  const currentHosts = new Set(currentConfigs.map(c => c.host));

  const removed = [];
  const added = [];

  // Remove failing servers from current configs
  const filtered = currentConfigs.filter(cfg => {
    const isFailing = failing.some(f => f.host === cfg.host && f.port === cfg.port);
    if (isFailing) {
      removed.push({
        host: cfg.host,
        port: cfg.port,
        reason: `${failing.find(f => f.host === cfg.host)?.consecutiveFailures || '?'} قطعی متوالی`,
      });
      return false;
    }
    return true;
  });

  // Find replacement servers from healthy pool that aren't already in the list
  const needed = removed.length;
  let addedCount = 0;

  for (const server of healthy) {
    if (addedCount >= needed) break;
    if (currentHosts.has(server.host)) continue; // Skip duplicates

    // We need the raw config for this server - check if it's in the health data
    added.push({
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      country: server.country,
      uptime: server.uptime,
      avgLatency: server.avgLatency,
    });
    addedCount++;
  }

  return {
    changed: removed.length > 0,
    removed,
    added,
    failingServers: failing,
    healthyServers: healthy.length,
    message: removed.length > 0
      ? `${removed.length} سرور قطع شده حذف شد → ${added.length} سرور جایگزین اضافه شد`
      : 'همه سرورها سالم هستند.',
  };
}

export function formatFailoverReport(result) {
  const lines = [];

  if (!result.changed) {
    lines.push('✅ <b>وضعیت عادی</b>');
    lines.push('');
    lines.push(result.message);
    return lines.join('\n');
  }

  lines.push('🔄 <b>عملیات Failover</b>');
  lines.push('');

  if (result.removed.length > 0) {
    lines.push('❌ <b>سرورهای قطع شده:</b>');
    for (const r of result.removed) {
      lines.push(`  <code>${r.host}:${r.port}</code> — ${r.reason}`);
    }
    lines.push('');
  }

  if (result.added.length > 0) {
    lines.push('✅ <b>سرورهای جایگزین:</b>');
    for (const a of result.added) {
      lines.push(`  ${flag(a.country)} <code>${a.host}:${a.port}</code> — آپتایم: ${a.uptime}%`);
    }
    lines.push('');
  }

  lines.push(`📊 سالم: ${result.healthyServers} | قطع شده: ${result.failingServers?.length || 0}`);

  return lines.join('\n');
}

function flag(code) {
  if (!code || code.length !== 2) return '🌐';
  const c = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}

export function getFailoverStats() {
  const { failing, healthy } = detectFailingServers();
  return {
    failingCount: failing.length,
    healthyCount: healthy.length,
    failing,
    topHealthy: healthy.slice(0, 10),
  };
}
