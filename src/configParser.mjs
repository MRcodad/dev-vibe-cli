import { Buffer } from 'buffer';

function extractSNI(url) {
  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    for (const key of ['sni', 'peer', 'servername']) {
      const val = params.get(key);
      if (val && !/^\d{1,3}(\.\d{1,3}){3}$/.test(val)) return val;
    }
    return null;
  } catch {
    return null;
  }
}

export function parseConfig(raw) {
  try {
    if (raw.startsWith('vmess://')) {
      const base64 = raw.replace('vmess://', '').trim();
      const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      return {
        protocol: 'vmess',
        host: decoded.add,
        port: parseInt(decoded.port),
        sni: decoded.sni || null,
        security: decoded.tls || 'none',
        type: decoded.net || 'tcp',
        path: decoded.path || null,
        raw,
      };
    }

    const parsed = new URL(raw);
    const proto = parsed.protocol.replace(':', '');
    const security = parsed.searchParams.get('security') || 'none';
    const sni = extractSNI(raw);
    const network = parsed.searchParams.get('type') || 'tcp';
    const path = parsed.searchParams.get('path') || null;

    return {
      protocol: proto,
      host: parsed.hostname,
      port: parseInt(parsed.port) || (proto === 'ss' ? 8388 : 443),
      sni,
      security,
      type: network,
      path,
      raw,
    };
  } catch {
    return null;
  }
}
