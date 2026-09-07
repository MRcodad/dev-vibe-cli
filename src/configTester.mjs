import net from 'net';
import tls from 'tls';
import { parseConfig } from './configParser.mjs';

const CONCURRENCY = 20;

function tcpConnect(host, port, timeout = 4000) {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = net.createConnection({ host, port, timeout });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, latency: timeout });
    }, timeout);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, latency });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve({ ok: false, latency: timeout });
    });

    socket.on('timeout', () => {
      socket.destroy();
      clearTimeout(timer);
      resolve({ ok: false, latency: timeout });
    });
  });
}

function tlsHandshake(host, port, sni, timeout = 5000) {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = tls.connect({
      host, port, servername: sni || host,
      rejectUnauthorized: false,
      timeout,
      minVersion: 'TLSv1.2',
    });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, latency: timeout });
    }, timeout);

    socket.on('secureConnect', () => {
      const latency = Date.now() - start;
      clearTimeout(timer);
      socket.destroy();
      resolve({ ok: true, latency });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve({ ok: false, latency: timeout });
    });

    socket.on('timeout', () => {
      socket.destroy();
      clearTimeout(timer);
      resolve({ ok: false, latency: timeout });
    });
  });
}

async function testConfig(config) {
  const info = parseConfig(config);
  if (!info || !info.host || !info.port) {
    return { alive: false, tlsOk: false, latency: 9999, speed: 0, country: null, ...info, raw: config };
  }

  const { host, port, security, protocol, sni } = info;

  // Stage 1: TCP Connect
  const tcp = await tcpConnect(host, port);
  if (!tcp.ok) {
    return { alive: false, tlsOk: false, latency: tcp.latency, speed: 0, country: null, ...info };
  }

  // Stage 2: TLS/Reality Handshake
  let tlsResult = { ok: false, latency: 0 };
  const needsTls = security === 'tls' || security === 'reality' || protocol === 'trojan';

  if (needsTls) {
    tlsResult = await tlsHandshake(host, port, sni || host);
  } else if (security === 'none' && protocol !== 'ss') {
    tlsResult = { ok: true, latency: 0 };
  } else {
    tlsResult = { ok: true, latency: 0 };
  }

  // Stage 3: Speed estimate
  const speed = tlsResult.ok ? Math.round(1024 / Math.max(tlsResult.latency, 1)) : 0;

  return {
    ...info,
    alive: true,
    tlsOk: tlsResult.ok,
    latency: tlsResult.latency || tcp.latency,
    speed,
    country: null,
  };
}

export async function runTests(configs, onProgress) {
  const results = [];
  let tested = 0;

  for (let i = 0; i < configs.length; i += CONCURRENCY) {
    const batch = configs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(cfg => testConfig(cfg)));
    results.push(...batchResults);
    tested += batchResults.length;
    if (onProgress) onProgress(tested, configs.length);
  }

  return results;
}
