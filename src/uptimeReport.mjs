import fs from 'fs';
import path from 'path';

const HEALTH_FILE = path.join(process.cwd(), 'dist', 'health.json');
const REPORT_FILE = path.join(process.cwd(), 'dist', 'uptime-report.json');

function loadHealth() {
  try {
    if (fs.existsSync(HEALTH_FILE)) {
      return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
    }
  } catch {}
  return { servers: {} };
}

function getServerUptime(history, maxEntries) {
  if (!history || history.length === 0) return { uptime: 0, checks: 0, alive: 0 };
  const recent = history.slice(-maxEntries);
  const aliveCount = recent.filter(h => h.alive).length;
  return {
    uptime: Math.round((aliveCount / recent.length) * 100),
    checks: recent.length,
    alive: aliveCount,
    dead: recent.length - aliveCount,
  };
}

function getOutages(history) {
  if (!history || history.length < 2) return [];

  const outages = [];
  let outageStart = null;

  for (let i = 0; i < history.length; i++) {
    if (!history[i].alive && !outageStart) {
      outageStart = history[i].timestamp;
    } else if (history[i].alive && outageStart) {
      outages.push({
        start: outageStart,
        end: history[i].timestamp,
        duration: Math.round((new Date(history[i].timestamp) - new Date(outageStart)) / 60000),
      });
      outageStart = null;
    }
  }

  // If still in outage
  if (outageStart) {
    outages.push({
      start: outageStart,
      end: null,
      duration: null,
      ongoing: true,
    });
  }

  return outages;
}

function getLatencyTrend(history) {
  if (!history || history.length === 0) return [];

  // Group by hour
  const hourly = {};
  for (const h of history) {
    if (!h.alive || !h.latency) continue;
    const hour = h.timestamp?.substring(0, 13); // "2026-09-07T14"
    if (!hourly[hour]) hourly[hour] = [];
    hourly[hour].push(h.latency);
  }

  return Object.entries(hourly).map(([hour, latencies]) => ({
    hour,
    avgLatency: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    minLatency: Math.min(...latencies),
    maxLatency: Math.max(...latencies),
    count: latencies.length,
  }));
}

export function generateUptimeReport() {
  const health = loadHealth();
  const servers = Object.entries(health.servers);
  const now = new Date();

  if (servers.length === 0) {
    return {
      generated: now.toISOString(),
      error: 'No data available',
    };
  }

  const serverReports = servers.map(([key, server]) => {
    const uptime24h = getServerUptime(server.history, 96);
    const uptime7d = getServerUptime(server.history, 672);
    const uptime30d = getServerUptime(server.history, 2880);
    const outages = getOutages(server.history);
    const trend = getLatencyTrend(server.history);

    const latencies = (server.history || [])
      .filter(h => h.alive && h.latency > 0)
      .map(h => h.latency);

    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    return {
      host: server.host,
      port: server.port,
      protocol: server.protocol,
      country: server.country,
      firstSeen: server.firstSeen,
      lastSeen: server.lastSeen,
      uptime: {
        '24h': uptime24h.uptime,
        '7d': uptime7d.uptime,
        '30d': uptime30d.uptime,
        checks24h: uptime24h.checks,
        alive24h: uptime24h.alive,
      },
      latency: {
        avg: avgLatency,
        min: minLatency,
        max: maxLatency,
      },
      outages: {
        total: outages.length,
        totalMinutes: outages.reduce((sum, o) => sum + (o.duration || 0), 0),
        ongoing: outages.some(o => o.ongoing),
        recent: outages.slice(-5),
      },
      trend: trend.slice(-24),
    };
  });

  // Global stats
  const totalServers = serverReports.length;
  const avgUptime24h = Math.round(
    serverReports.reduce((a, b) => a + b.uptime['24h'], 0) / totalServers
  );
  const avgUptime7d = Math.round(
    serverReports.reduce((a, b) => a + b.uptime['7d'], 0) / totalServers
  );
  const avgLatency = Math.round(
    serverReports.filter(s => s.latency.avg > 0).reduce((a, b) => a + b.latency.avg, 0) /
    serverReports.filter(s => s.latency.avg > 0).length || 1
  );
  const totalOutages = serverReports.reduce((a, b) => a + b.outages.total, 0);
  const ongoingOutages = serverReports.filter(s => s.outages.ongoing).length;

  // Best and worst
  const sorted = [...serverReports].sort((a, b) => b.uptime['24h'] - a.uptime['24h']);
  const bestServers = sorted.filter(s => s.uptime['24h'] >= 80).slice(0, 5);
  const worstServers = sorted.filter(s => s.uptime['24h'] < 50).slice(0, 5).reverse();

  // Country breakdown
  const byCountry = {};
  for (const s of serverReports) {
    const c = s.country || 'Unknown';
    if (!byCountry[c]) byCountry[c] = { servers: 0, avgUptime: 0, avgLatency: 0 };
    byCountry[c].servers++;
    byCountry[c].avgUptime += s.uptime['24h'];
    byCountry[c].avgLatency += s.latency.avg;
  }
  for (const c of Object.values(byCountry)) {
    c.avgUptime = Math.round(c.avgUptime / c.servers);
    c.avgLatency = Math.round(c.avgLatency / c.servers);
  }

  const report = {
    generated: now.toISOString(),
    period: {
      start: serverReports.reduce((min, s) => s.firstSeen < min ? s.firstSeen : min, serverReports[0].firstSeen),
      end: now.toISOString(),
    },
    summary: {
      totalServers,
      avgUptime24h,
      avgUptime7d,
      avgLatency,
      totalOutages,
      ongoingOutages,
    },
    bestServers,
    worstServers,
    byCountry,
    servers: serverReports,
  };

  // Save report
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  return report;
}

export function formatUptimeReport(report) {
  if (!report || report.error) return '❌ داده‌ای موجود نیست.';

  const s = report.summary;
  const lines = [
    '📊 <b>گزارش آپتایم</b>',
    `📅 ${report.period?.start?.split('T')[0] || '?'} → ${report.period?.end?.split('T')[0] || '?'}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    '',
    `🟢 <b>آپتایم ۲۴ ساعته:</b> ${s.avgUptime24h}%`,
    `🟢 <b>آپتایم ۷ روزه:</b> ${s.avgUptime7d}%`,
    `⚡ <b>میانگین پاسخ:</b> ${s.avgLatency}ms`,
    `🖥 <b>کل سرورها:</b> ${s.totalServers}`,
    `🔴 <b>قطعی‌ها:</b> ${s.totalOutages} مورد (${s.totalOutages * 15} دقیقه)`,
    `⚠️ <b>قطعی فعال:</b> ${s.ongoingOutages}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
  ];

  if (report.bestServers?.length > 0) {
    lines.push('', '🏆 <b>بهترین سرورها:</b>');
    for (const srv of report.bestServers) {
      const f = flag(srv.country);
      lines.push(`  ${f} <code>${srv.host}:${srv.port}</code>`);
      lines.push(`    📈 آپتایم: ${srv.uptime['24h']}% | ⚡ ${srv.latency.avg}ms | 🔌 ${srv.protocol?.toUpperCase()}`);
    }
  }

  if (report.worstServers?.length > 0) {
    lines.push('', '⚠️ <b>ضعیف‌ترین سرورها:</b>');
    for (const srv of report.worstServers) {
      const f = flag(srv.country);
      lines.push(`  ${f} <code>${srv.host}:${srv.port}</code>`);
      lines.push(`    📉 آپتایم: ${srv.uptime['24h']}% | ${srv.outages.total} قطعی`);
    }
  }

  if (report.byCountry && Object.keys(report.byCountry).length > 0) {
    lines.push('', '🌍 <b>آپتایم بر اساس کشور:</b>');
    const sorted = Object.entries(report.byCountry).sort((a, b) => b[1].avgUptime - a[1].avgUptime);
    for (const [code, data] of sorted) {
      const f = flag(code);
      const bar = '█'.repeat(Math.round(data.avgUptime / 10));
      lines.push(`  ${f} <b>${code}</b>: ${data.avgUptime}% ${bar} (${data.servers} سرور)`);
    }
  }

  return lines.join('\n');
}

function flag(code) {
  if (!code || code.length !== 2) return '🌐';
  const c = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}

export function generateUptimeHTML(report) {
  if (!report || report.error) return '<html><body><h1>No data</h1></body></html>';

  const s = report.summary;
  const servers = report.servers || [];

  const rows = servers.map(srv => {
    const f = flag(srv.country);
    const uptimeColor = srv.uptime['24h'] >= 80 ? '#22c55e' : srv.uptime['24h'] >= 50 ? '#f59e0b' : '#ef4444';
    const barWidth = Math.max(srv.uptime['24h'], 2);
    return `<tr>
      <td>${f} <code>${srv.host}:${srv.port}</code></td>
      <td><span style="color:#a855f7">${(srv.protocol||'?').toUpperCase()}</span></td>
      <td>${srv.country||'?'}</td>
      <td><div style="width:100%;height:8px;background:#1a1a3e;border-radius:4px;overflow:hidden"><div style="width:${barWidth}%;height:100%;background:${uptimeColor};border-radius:4px"></div></div><span style="color:${uptimeColor};font-weight:700;font-size:12px">${srv.uptime['24h']}%</span></td>
      <td><span style="color:${srv.latency.avg<200?'#22c55e':srv.latency.avg<500?'#f59e0b':'#ef4444'}">${srv.latency.avg}ms</span></td>
      <td>${srv.outages.total}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MRCODAD Uptime Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a1a;color:#e0e0e0;padding:20px}
.header{text-align:center;padding:30px 0}
.header h1{font-size:24px;background:linear-gradient(90deg,#22c55e,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:20px 0}
.stat{background:#1a1a3e;border-radius:10px;padding:16px;text-align:center;border:1px solid #2a2a5a}
.stat .val{font-size:28px;font-weight:700}
.stat .lbl{color:#888;font-size:11px;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-top:20px}
th{text-align:right;padding:10px;color:#888;font-size:11px;text-transform:uppercase;border-bottom:2px solid #2a2a5a}
td{padding:8px;border-bottom:1px solid #1a1a3e;font-size:12px}
.card{background:#1a1a3e;border-radius:10px;padding:16px;border:1px solid #2a2a5a;margin:16px 0}
@media(max-width:768px){.stats{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>
<div class="header">
  <h1>📊 MRCODAD Uptime Report</h1>
  <p style="color:#888;margin-top:8px">${report.period?.start?.split('T')[0]||'?'} → ${report.period?.end?.split('T')[0]||'?'} | Generated: ${new Date().toLocaleString('fa-IR')}</p>
</div>
<div class="stats">
  <div class="stat"><div class="val" style="color:#22c55e">${s.avgUptime24h}%</div><div class="lbl">آپتایم ۲۴ ساعته</div></div>
  <div class="stat"><div class="val" style="color:#3b82f6">${s.avgLatency}ms</div><div class="lbl">میانگین پاسخ</div></div>
  <div class="stat"><div class="val" style="color:#a855f7">${s.totalServers}</div><div class="lbl">کل سرورها</div></div>
  <div class="stat"><div class="val" style="color:#ef4444">${s.totalOutages}</div><div class="lbl">قطعی‌ها</div></div>
</div>
<div class="card">
  <h3 style="color:#ccc;margin-bottom:12px">لیست سرورها</h3>
  <div style="overflow-x:auto">
    <table>
      <thead><tr><th>سرور</th><th>پروتکل</th><th>کشور</th><th>آپتایم ۲۴ ساعته</th><th>پاسخ</th><th>قطعی</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>
</body>
</html>`;
}
