import tls from 'tls';
import https from 'https';
import http from 'http';

const TEST_FILE = 'https://speed.cloudflare.com/__down?bytes=1048576'; // 1MB
const SPEED_TIMEOUT = 8000;

// ─── TLS Handshake Speed ───

function measureTLSHandshake(host, port, sni, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const socket = tls.connect({
      host,
      port,
      servername: sni || host,
      rejectUnauthorized: false,
      timeout,
      ALPNProtocols: ['h2', 'http/1.1'],
    }, () => {
      const latency = Date.now() - start;
      const protocol = socket.getProtocol();
      const cipher = socket.getCipher();
      socket.destroy();
      resolve({
        success: true,
        latency,
        protocol: protocol || 'unknown',
        cipher: cipher?.name || 'unknown',
      });
    });

    socket.on('error', () => {
      resolve({ success: false, latency: -1, protocol: 'none', cipher: 'none' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, latency: -1, protocol: 'timeout', cipher: 'timeout' });
    });
  });
}

// ─── Download Speed Test ───

function measureDownloadSpeed(url, timeout = SPEED_TIMEOUT) {
  return new Promise((resolve) => {
    const start = Date.now();
    let received = 0;

    const request = (url.startsWith('https') ? https : http).get(url, {
      timeout,
      headers: { 'User-Agent': 'MRCODAD-SpeedTest/1.0' },
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        measureDownloadSpeed(res.headers.location, timeout).then(resolve);
        return;
      }

      if (res.statusCode !== 200) {
        resolve({ speed: 0, downloaded: 0, time: 0, error: `HTTP ${res.statusCode}` });
        return;
      }

      const contentLength = parseInt(res.headers['content-length'] || '0');

      res.on('data', (chunk) => {
        received += chunk.length;

        // Stop after 2 seconds or after receiving enough data
        const elapsed = Date.now() - start;
        if (elapsed >= 2000 || received >= 524288) { // 512KB max
          res.destroy();
          const totalElapsed = Date.now() - start;
          const speed = (received / 1024) / (totalElapsed / 1000); // KB/s
          resolve({
            speed: Math.round(speed),
            downloaded: received,
            expectedSize: contentLength,
            time: totalElapsed,
          });
        }
      });

      res.on('end', () => {
        const elapsed = Date.now() - start;
        const speed = elapsed > 0 ? (received / 1024) / (elapsed / 1000) : 0;
        resolve({
          speed: Math.round(speed),
          downloaded: received,
          expectedSize: contentLength,
          time: elapsed,
        });
      });

      res.on('error', () => {
        resolve({ speed: 0, downloaded: received, time: Date.now() - start, error: 'read error' });
      });
    });

    request.on('error', () => {
      resolve({ speed: 0, downloaded: 0, time: Date.now() - start, error: 'connection error' });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ speed: 0, downloaded: received, time: Date.now() - start, error: 'timeout' });
    });
  });
}

// ─── Full Speed Test ───

export async function runSpeedTest(config, iterations = 2) {
  const host = config.host;
  const port = config.port || 443;
  const sni = config.sni || host;

  // Phase 1: TLS Handshake
  const tlsResult = await measureTLSHandshake(host, port, sni);

  if (!tlsResult.success) {
    return {
      host, port, sni,
      tlsOk: false,
      tlsLatency: -1,
      tlsProtocol: 'none',
      avgSpeed: 0,
      maxSpeed: 0,
      minSpeed: 0,
      speeds: [],
      grade: 'F',
    };
  }

  // Phase 2: Download speed test (multiple iterations)
  const speeds = [];

  for (let i = 0; i < iterations; i++) {
    const dlResult = await measureDownloadSpeed(TEST_FILE);
    if (dlResult.speed > 0) {
      speeds.push(dlResult.speed);
    }
  }

  const avgSpeed = speeds.length > 0 ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : 0;
  const minSpeed = speeds.length > 0 ? Math.min(...speeds) : 0;

  // Calculate grade
  const grade = getSpeedGrade(avgSpeed, tlsResult.latency);

  return {
    host,
    port,
    sni,
    tlsOk: true,
    tlsLatency: tlsResult.latency,
    tlsProtocol: tlsResult.protocol,
    tlsCipher: tlsResult.cipher,
    avgSpeed,
    maxSpeed,
    minSpeed,
    speeds,
    grade,
  };
}

// ─── Batch Speed Test ───

export async function runBatchSpeedTest(configs, onProgress, concurrency = 5) {
  const results = [];

  for (let i = 0; i < configs.length; i += concurrency) {
    const batch = configs.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(cfg => runSpeedTest(cfg))
    );

    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + concurrency, configs.length), configs.length);
    }
  }

  return results;
}

// ─── Grading ───

function getSpeedGrade(speedKBs, tlsLatency) {
  let score = 0;

  // Speed scoring (max 60)
  if (speedKBs >= 500) score += 60;
  else if (speedKBs >= 200) score += 50;
  else if (speedKBs >= 100) score += 40;
  else if (speedKBs >= 50) score += 30;
  else if (speedKBs >= 20) score += 20;
  else if (speedKBs > 0) score += 10;

  // Latency scoring (max 40)
  if (tlsLatency <= 100) score += 40;
  else if (tlsLatency <= 200) score += 35;
  else if (tlsLatency <= 300) score += 25;
  else if (tlsLatency <= 500) score += 15;
  else if (tlsLatency <= 1000) score += 5;

  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

export function getSpeedGradeColor(grade) {
  const colors = {
    'A+': '#22c55e', 'A': '#22c55e',
    'B+': '#3b82f6', 'B': '#3b82f6',
    'C+': '#f59e0b', 'C': '#f59e0b',
    'D': '#ef4444', 'F': '#991b1b',
  };
  return colors[grade] || '#666';
}

export function formatSpeed(speedKBs) {
  if (speedKBs >= 1024) return `${(speedKBs / 1024).toFixed(1)} MB/s`;
  return `${speedKBs} KB/s`;
}
