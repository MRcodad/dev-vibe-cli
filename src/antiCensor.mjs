import net from 'net';
import tls from 'tls';

// ─── Known blocked patterns by Iranian DPI ───

const BLOCKED_PORTS = new Set([25, 465, 587, 80]);

const CDN_DOMAINS = new Set([
  'cloudflare.com', 'cloudfront.net', 'fastly.net', 'akamai.net',
  'azureedge.net', 'azure.com', 'googleapis.com', 'google.com',
  'amazonaws.com', 'cdn77.org', 'bitgravity.com', 'highwinds.com',
  'limelight.com', 'maxcdn.com', 'bootstrapcdn.com', 'jsdelivr.net',
]);

const KNOWN_DPI_SNI_PATTERNS = [
  /^api\./i, /^cdn\./i, /^static\./i, /^assets\./i,
  /^fonts\./i, /^images\./i, /^media\./i,
];

// Well-known cloud providers (less likely to be fully blocked)
const CLOUD_ASNS = new Set([
  'AS13335',  // Cloudflare
  'AS16509',  // Amazon
  'AS15169',  // Google
  'AS8075',   // Microsoft
  'AS14618',  // Amazon
  'AS14061',  // DigitalOcean
  'AS24940',  // Hetzner
  'AS20473',  // Vultr
  'AS200019', // ALEXHOST
]);

// ─── Heuristic Scoring ───

function analyzeConfig(config) {
  const score = { total: 100, factors: [], blocked: false, risk: 'low' };
  const host = (config.host || '').toLowerCase();
  const port = config.port || 443;
  const sni = (config.sni || host).toLowerCase();
  const security = (config.security || '').toLowerCase();

  // Port analysis
  if (BLOCKED_PORTS.has(port)) {
    score.total -= 40;
    score.factors.push({ factor: 'blocked_port', impact: -40, detail: `Port ${port} commonly blocked` });
  } else if (port === 443 || port === 8443) {
    score.total += 5;
    score.factors.push({ factor: 'standard_port', impact: +5, detail: 'Standard HTTPS port' });
  } else if (port >= 1000 && port <= 65535) {
    score.total += 10;
    score.factors.push({ factor: 'high_port', impact: +10, detail: `High port ${port} less likely blocked` });
  }

  // SNI/Domain analysis
  if (sni) {
    // CDN domains are harder to block
    const isCDN = CDN_DOMAINS.has(sni) || [...CDN_DOMAINS].some(d => sni.endsWith('.' + d));
    if (isCDN) {
      score.total += 20;
      score.factors.push({ factor: 'cdn_domain', impact: +20, detail: `CDN domain: ${sni}` });
    }

    // Check if SNI looks like an IP (easier to block)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(sni)) {
      score.total -= 15;
      score.factors.push({ factor: 'ip_sni', impact: -15, detail: 'SNI is IP address (easier to block)' });
    }

    // Known DPI patterns
    for (const pattern of KNOWN_DPI_SNI_PATTERNS) {
      if (pattern.test(sni)) {
        score.total -= 5;
        score.factors.push({ factor: 'dpi_pattern', impact: -5, detail: `SNI matches DPI pattern: ${sni}` });
        break;
      }
    }

    // Cloudflare SNI (hard to block without breaking many sites)
    if (sni.includes('cloudflare') || sni.includes('sentry')) {
      score.total += 15;
      score.factors.push({ factor: 'cloudflare_sni', impact: +15, detail: 'Cloudflare SNI (hard to block)' });
    }
  }

  // Security/Protocol analysis
  if (security === 'reality') {
    score.total += 25;
    score.factors.push({ factor: 'reality', impact: +25, detail: 'VLESS REALITY (hardest to detect)' });
  } else if (security === 'tls') {
    score.total += 10;
    score.factors.push({ factor: 'tls', impact: +10, detail: 'TLS encryption' });
  } else if (security === 'none' || !security) {
    score.total -= 20;
    score.factors.push({ factor: 'no_encryption', impact: -20, detail: 'No encryption (easily detected)' });
  }

  // Protocol analysis
  if (config.protocol === 'vless') {
    score.total += 5;
    score.factors.push({ factor: 'vless', impact: +5, detail: 'VLESS protocol (lightweight)' });
  }

  // WebSocket + TLS = looks like normal web traffic
  if ((config.type === 'ws' || config.path) && security === 'tls') {
    score.total += 15;
    score.factors.push({ factor: 'ws_tls', impact: +15, detail: 'WebSocket+TLS (looks like web traffic)' });
  }

  // Clamp score
  score.total = Math.max(0, Math.min(100, score.total));

  // Determine risk level
  if (score.total >= 80) score.risk = 'low';
  else if (score.total >= 60) score.risk = 'medium';
  else if (score.total >= 40) score.risk = 'high';
  else { score.risk = 'very_high'; score.blocked = true; }

  return score;
}

// ─── TCP-based accessibility test ───

async function testAccessibility(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout });

    const done = (reachable) => {
      socket.destroy();
      resolve({ reachable, latency: reachable ? Date.now() - start : -1 });
    };

    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

// ─── Main anti-censorship analysis ───

export async function analyzeCensorship(configs, onProgress) {
  const results = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < configs.length; i += BATCH_SIZE) {
    const batch = configs.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(batch.map(async (cfg) => {
      const heuristic = analyzeConfig(cfg);
      const { reachable, latency } = await testAccessibility(cfg.host, cfg.port);

      return {
        ...cfg,
        censorScore: heuristic.total,
        censorRisk: heuristic.risk,
        censorFactors: heuristic.factors,
        accessible: reachable,
        accessLatency: latency,
        likelyBlocked: heuristic.blocked || (!reachable && heuristic.total < 50),
      };
    }));

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, configs.length), configs.length);
    }
  }

  return results;
}

export function getCensorSummary(results) {
  const accessible = results.filter(r => r.accessible).length;
  const likelyBlocked = results.filter(r => r.likelyBlocked).length;
  const lowRisk = results.filter(r => r.censorRisk === 'low').length;
  const mediumRisk = results.filter(r => r.censorRisk === 'medium').length;
  const highRisk = results.filter(r => r.censorRisk === 'high').length;

  const riskDistribution = { low: lowRisk, medium: mediumRisk, high: highRisk, very_high: results.length - lowRisk - mediumRisk - highRisk };

  return {
    total: results.length,
    accessible,
    likelyBlocked,
    riskDistribution,
    avgCensorScore: Math.round(results.reduce((a, b) => a + b.censorScore, 0) / results.length),
  };
}

export { analyzeConfig };
