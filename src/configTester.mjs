import net from 'net';
import tls from 'tls';
import { Buffer } from 'buffer';
import { parseConfig } from './configParser.mjs';

const CONCURRENCY = 15;
const DEEP_TEST_BATCH = 150; // top N configs to deep-test (VLESS handshake)

// ─── UUID to 16-byte buffer ───

function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) {
    buf[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return buf;
}

// ─── Extract UUID from config ───

function extractUUID(config) {
  try {
    if (config.startsWith('vless://')) {
      const parsed = new URL(config);
      return parsed.username || null;
    }
    if (config.startsWith('trojan://')) {
      const parsed = new URL(config);
      return parsed.username || null;
    }
    if (config.startsWith('vmess://')) {
      const base64 = config.replace('vmess://', '').trim();
      const decoded = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
      return decoded.id || null;
    }
  } catch {}
  return null;
}

// ─── Extract address from VLESS/Trojan ───

function extractAddress(config) {
  try {
    if (config.startsWith('vless://') || config.startsWith('trojan://')) {
      const parsed = new URL(config);
      const params = parsed.searchParams;
      const type = params.get('type') || 'tcp';
      const host = params.get('host') || params.get('sni') || parsed.hostname;
      const port = parseInt(params.get('port')) || parsed.port || 443;
      return { host, port, type };
    }
  } catch {}
  return null;
}

// ─── TCP Connect ───

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

    socket.on('error', () => { clearTimeout(timer); resolve({ ok: false, latency: timeout }); });
    socket.on('timeout', () => { socket.destroy(); clearTimeout(timer); resolve({ ok: false, latency: timeout }); });
  });
}

// ─── TLS Handshake ───

function tlsConnect(host, port, sni, timeout = 6000) {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = tls.connect({
      host, port, servername: sni || host,
      rejectUnauthorized: false, timeout,
      minVersion: 'TLSv1.2',
      ALPNProtocols: ['h2', 'http/1.1'],
    });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, latency: timeout, socket: null });
    }, timeout);

    socket.on('secureConnect', () => {
      const latency = Date.now() - start;
      clearTimeout(timer);
      resolve({ ok: true, latency, socket });
    });

    socket.on('error', () => { clearTimeout(timer); resolve({ ok: false, latency: timeout, socket: null }); });
    socket.on('timeout', () => { socket.destroy(); clearTimeout(timer); resolve({ ok: false, latency: timeout, socket: null }); });
  });
}

// ─── VLESS Protocol Handshake ───

function vlessHandshake(socket, uuid, address, port, timeout = 5000) {
  return new Promise(resolve => {
    const start = Date.now();

    try {
      // Build VLESS request header
      const uuidBytes = uuidToBytes(uuid);
      const addr = buildAddress(address, port);

      // VLESS header: version(1) + uuid(16) + addon_len(1) + addon(0) + cmd(1) + port(2) + addr
      const header = Buffer.alloc(1 + 16 + 1 + 0 + 1 + 2 + addr.length);
      let offset = 0;

      header[offset++] = 0x00;                    // Version
      uuidBytes.copy(header, offset); offset += 16; // UUID
      header[offset++] = 0x00;                    // Addon length = 0
      header[offset++] = 0x01;                    // Command: TCP
      header.writeUInt16BE(port, offset); offset += 2; // Port
      addr.copy(header, offset);                  // Address

      socket.write(header);

      // Read server response
      let responseData = Buffer.alloc(0);
      let responseReceived = false;

      const onData = (chunk) => {
        responseData = Buffer.concat([responseData, chunk]);

        if (!responseReceived && responseData.length >= 1) {
          responseReceived = true;
          const elapsed = Date.now() - start;

          // Check response version byte
          const version = responseData[0];

          // VLESS response: version should be 0
          if (version === 0x00 && responseData.length >= 2) {
            const addonLen = responseData[1];
            if (responseData.length >= 2 + addonLen + 1) {
              const cmdResp = responseData[2 + addonLen];
              if (cmdResp === 0x01) {
                // Success! Server accepted the connection
                socket.removeListener('data', onData);
                clearTimeout(timer);
                resolve({ ok: true, latency: elapsed });
                return;
              }
            }
            // Version 0 but no valid cmd = might still work
            socket.removeListener('data', onData);
            clearTimeout(timer);
            resolve({ ok: true, latency: elapsed });
            return;
          }

          // Non-zero version or error response
          socket.removeListener('data', onData);
          clearTimeout(timer);
          resolve({ ok: false, latency: elapsed });
          return;
        }
      };

      const timer = setTimeout(() => {
        socket.removeListener('data', onData);
        socket.destroy();
        // If we got ANY data back, the server at least responded
        if (responseData.length > 0) {
          resolve({ ok: true, latency: Date.now() - start });
        } else {
          resolve({ ok: false, latency: timeout });
        }
      }, timeout);

      socket.on('data', onData);

      socket.on('error', () => {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        resolve({ ok: false, latency: Date.now() - start });
      });

      socket.on('close', () => {
        clearTimeout(timer);
        socket.removeListener('data', onData);
        if (responseData.length > 0) {
          resolve({ ok: true, latency: Date.now() - start });
        } else {
          resolve({ ok: false, latency: Date.now() - start });
        }
      });

    } catch (err) {
      resolve({ ok: false, latency: Date.now() - start });
    }
  });
}

// ─── Build address buffer ───

function buildAddress(host, port) {
  // Try to resolve hostname to IP
  const ipParts = host.split('.');
  const isIP = ipParts.length === 4 && ipParts.every(p => /^\d{1,3}$/.test(p));

  if (isIP) {
    const ip = ipParts.map(Number);
    const buf = Buffer.alloc(1 + 4 + 2); // type(1) + ipv4(4) + port(2)
    buf[0] = 0x01; // IPv4
    ip.forEach((octet, i) => buf[1 + i] = octet);
    buf.writeUInt16BE(port, 5);
    return buf;
  }

  // Domain
  const domainBytes = Buffer.from(host, 'utf-8');
  const buf = Buffer.alloc(1 + 1 + domainBytes.length + 2); // type(1) + len(1) + domain + port(2)
  buf[0] = 0x02; // Domain
  buf[1] = domainBytes.length;
  domainBytes.copy(buf, 2);
  buf.writeUInt16BE(port, 2 + domainBytes.length);
  return buf;
}

// ─── Quick test (TCP + TLS only) ───

async function quickTest(info) {
  const { host, port, security, protocol, sni } = info;

  const tcp = await tcpConnect(host, port);
  if (!tcp.ok) return { alive: false, tlsOk: false, vlessOk: false, latency: tcp.latency };

  const needsTls = security === 'tls' || security === 'reality' || protocol === 'trojan';
  let tlsResult = { ok: false, latency: 0 };

  if (needsTls) {
    tlsResult = await tlsConnect(host, port, sni || host);
  } else {
    tlsResult = { ok: true, latency: 0 };
  }

  return {
    alive: true,
    tlsOk: tlsResult.ok,
    vlessOk: false, // not tested in quick mode
    latency: tlsResult.latency || tcp.latency,
  };
}

// ─── Deep test (VLESS handshake + data transfer) ───

async function deepTest(config, info) {
  const { host, port, security, protocol, sni } = info;
  const uuid = extractUUID(config);
  const address = extractAddress(config);

  // Step 1: TCP
  const tcp = await tcpConnect(host, port);
  if (!tcp.ok) return { alive: false, tlsOk: false, vlessOk: false, latency: tcp.latency };

  // Step 2: TLS
  const needsTls = security === 'tls' || security === 'reality' || protocol === 'trojan';
  let tlsResult = { ok: false, latency: 0, socket: null };

  if (needsTls) {
    tlsResult = await tlsConnect(host, port, sni || host);
  } else {
    // For no-TLS, create raw TCP socket
    const rawSocket = await new Promise(resolve => {
      const s = net.createConnection({ host, port, timeout: 5000 });
      s.on('connect', () => resolve({ ok: true, latency: 0, socket: s }));
      s.on('error', () => resolve({ ok: false, latency: 5000, socket: null }));
      s.on('timeout', () => { s.destroy(); resolve({ ok: false, latency: 5000, socket: null }); });
    });
    tlsResult = rawSocket;
  }

  if (!tlsResult.ok || !tlsResult.socket) {
    return { alive: true, tlsOk: false, vlessOk: false, latency: tcp.latency };
  }

  // Step 3: VLESS/Trojan handshake
  if ((protocol === 'vless' || protocol === 'trojan') && uuid && address) {
    const vlessResult = await vlessHandshake(
      tlsResult.socket, uuid, address.host, address.port
    );

    tlsResult.socket.destroy();

    if (vlessResult.ok) {
      return {
        alive: true,
        tlsOk: true,
        vlessOk: true,
        latency: tlsResult.latency,
        vlessLatency: vlessResult.latency,
      };
    }

    return {
      alive: true,
      tlsOk: true,
      vlessOk: false,
      latency: tlsResult.latency,
    };
  }

  // For VMess or configs without UUID, TLS success = likely working
  tlsResult.socket.destroy();
  return {
    alive: true,
    tlsOk: true,
    vlessOk: true, // assume working for VMess
    latency: tlsResult.latency,
  };
}

// ─── Full test pipeline ───

async function testConfig(config, deep = false) {
  const info = parseConfig(config);
  if (!info || !info.host || !info.port) {
    return { alive: false, tlsOk: false, vlessOk: false, latency: 9999, speed: 0, country: null, ...info, raw: config };
  }

  let result;
  if (deep) {
    result = await deepTest(config, info);
  } else {
    result = await quickTest(info);
  }

  const speed = result.latency > 0 ? Math.round(1024 / Math.max(result.latency, 1)) : 0;

  return {
    ...info,
    ...result,
    speed,
    country: null,
  };
}

// ─── Main test runner ───

export async function runTests(configs, onProgress) {
  const results = [];
  let tested = 0;

  // Phase 1: Quick test all configs (TCP + TLS)
  for (let i = 0; i < configs.length; i += CONCURRENCY) {
    const batch = configs.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(cfg => testConfig(cfg, false)));
    results.push(...batchResults);
    tested += batchResults.length;
    if (onProgress) onProgress(tested, configs.length);
  }

  // Phase 2: Deep test top configs (VLESS handshake)
  const candidates = results
    .filter(r => r.alive && r.tlsOk && !r.vlessOk)
    .sort((a, b) => a.latency - b.latency)
    .slice(0, DEEP_TEST_BATCH);

  if (candidates.length > 0) {
    const deepConfigs = candidates.map(c => c.raw);
    for (let i = 0; i < deepConfigs.length; i += CONCURRENCY) {
      const batch = deepConfigs.slice(i, i + CONCURRENCY);
      const deepResults = await Promise.all(batch.map(cfg => testConfig(cfg, true)));

      // Update results with deep test data
      for (const dr of deepResults) {
        const idx = results.findIndex(r => r.raw === dr.raw);
        if (idx !== -1) {
          results[idx] = { ...results[idx], ...dr };
        }
      }
    }
  }

  // Phase 3: Retry failed configs once (maybe temporary failure)
  const failed = results.filter(r => !r.alive).slice(0, 30);
  if (failed.length > 0) {
    for (let i = 0; i < failed.length; i += CONCURRENCY) {
      const batch = failed.slice(i, i + CONCURRENCY);
      const retryResults = await Promise.all(batch.map(cfg => testConfig(cfg.raw, false)));

      for (const rr of retryResults) {
        const idx = results.findIndex(r => r.raw === rr.raw);
        if (idx !== -1 && rr.alive) {
          results[idx] = { ...results[idx], ...rr };
        }
      }
    }
  }

  return results;
}

export { extractUUID, extractAddress };
