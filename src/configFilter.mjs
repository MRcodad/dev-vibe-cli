import axios from 'axios';

// --- Protocol scoring ---
const PROTOCOL_SCORES = {
  'vless-reality': 35,
  'vless-tls': 30,
  'trojan-tls': 28,
  'vmess-tls-ws': 25,
  'vmess-ws': 20,
  'vmess-tls': 25,
  'vless-ws': 18,
  'ss': 15,
};

function protocolKey(result) {
  if (!result.protocol) return 'unknown';
  if (result.protocol === 'ss') return 'ss';
  const parts = [result.protocol];
  if (result.security && result.security !== 'none') parts.push(result.security);
  if (result.type === 'ws') parts.push('ws');
  return parts.join('-');
}

function protocolScore(result) {
  return PROTOCOL_SCORES[protocolKey(result)] || 10;
}

function latencyScore(ms) {
  if (ms < 200) return 15;
  if (ms < 500) return 8;
  if (ms < 1000) return 3;
  return 0;
}

function tlsScore(result) {
  if (result.tlsOk) return 10;
  if (result.protocol === 'ss') return 5;
  return 0;
}

function portScore(result) {
  if ([443, 8443].includes(result.port)) return 5;
  if ([80, 8080].includes(result.port)) return 2;
  return 0;
}

function sniScore(result) {
  if (result.sni && !/^\d{1,3}(\.\d{1,3}){3}$/.test(result.sni)) return 5;
  return 0;
}

function pathScore(result) {
  if (result.path && result.path.length > 1) return 3;
  return 0;
}

export function scoreConfig(result) {
  if (!result.alive) return 0;

  let score = protocolScore(result)
    + latencyScore(result.latency)
    + tlsScore(result)
    + portScore(result)
    + sniScore(result)
    + pathScore(result);

  // VLESS handshake success = high confidence this config works
  if (result.vlessOk) score += 20;
  // TLS success but VLESS not tested = medium confidence
  else if (result.tlsOk) score += 5;

  return score;
}

// --- Country detection ---
const GEO_CACHE = new Map();
const BLACKLISTED_PORTS = new Set([25, 587, 465]);
const RATE_LIMIT_MS = 250;

async function batchGetCountries(ips) {
  const uniqueIps = [...new Set(ips)].filter(ip => ip && !GEO_CACHE.has(ip));

  for (let i = 0; i < uniqueIps.length; i += 50) {
    const batch = uniqueIps.slice(i, i + 50);
    const promises = batch.map(ip =>
      axios.get(`http://ip-api.com/json/${ip}?fields=countryCode`, { timeout: 3000 })
        .then(res => {
          if (res.data?.countryCode) GEO_CACHE.set(ip, res.data.countryCode);
        })
        .catch(() => {})
    );
    await Promise.all(promises);
    if (i + 50 < uniqueIps.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  return (ip) => GEO_CACHE.get(ip) || null;
}

// --- Smart filter ---
export async function filterConfigs(testedConfigs, options = {}) {
  const {
    countryInclude = null,
    countryExclude = null,
    blacklistPorts = true,
    blacklistKeywords = ['iran', 'ir', 'blocked'],
    minScore = 30,
    maxLatency = 2000,
    fastMode = false,
    onProgress = null,
  } = options;

  // Country detection (skip in fast mode or when not filtering by country)
  const needsCountry = !fastMode && (countryInclude || countryExclude);
  if (needsCountry) {
    if (onProgress) onProgress('country');
    const getCountry = await batchGetCountries(testedConfigs.map(c => c.host || c.address));
    for (const cfg of testedConfigs) {
      cfg.country = getCountry(cfg.host || cfg.address);
    }
  }

  // Filter
  let filtered = testedConfigs.filter(result => {
    if (!result.alive) return false;
    if (result.latency > maxLatency) return false;

    if (blacklistPorts && BLACKLISTED_PORTS.has(result.port)) return false;

    if (result.sni) {
      const sniLower = result.sni.toLowerCase();
      for (const kw of blacklistKeywords) {
        if (sniLower.includes(kw)) return false;
      }
    }

    if (countryInclude && result.country) {
      if (!countryInclude.includes(result.country)) return false;
    }

    if (countryExclude && result.country) {
      if (countryExclude.includes(result.country)) return false;
    }

    result.score = scoreConfig(result);
    if (result.score < minScore) return false;

    return true;
  });

  // Prioritize VLESS-validated configs (vlessOk = true)
  const vlessValidated = filtered.filter(r => r.vlessOk);
  const tlsOnly = filtered.filter(r => !r.vlessOk && r.tlsOk);

  // Sort each group by score
  vlessValidated.sort((a, b) => b.score - a.score);
  tlsOnly.sort((a, b) => b.score - a.score);

  // Prefer VLESS-validated, fill with TLS-only if needed
  const result = [...vlessValidated];
  if (result.length < 50) {
    result.push(...tlsOnly.slice(0, 50 - result.length));
  }

  return result;
}
