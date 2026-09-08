import fs from 'fs';
import path from 'path';

const CROWD_FILE = path.join(process.cwd(), 'dist', 'crowd-test.json');

function loadData() {
  try {
    if (fs.existsSync(CROWD_FILE)) {
      return JSON.parse(fs.readFileSync(CROWD_FILE, 'utf8'));
    }
  } catch {}
  return { reports: {}, configStats: {}, topReporters: [] };
}

function saveData(data) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(CROWD_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getConfigKey(host, port) {
  return `${host}:${port}`;
}

// ─── Submit a report ───

export function submitReport(userId, username, host, port, working, latency = null, speed = null) {
  const data = loadData();
  const key = getConfigKey(host, port);
  const timestamp = new Date().toISOString();

  // Initialize config stats
  if (!data.configStats[key]) {
    data.configStats[key] = {
      host, port,
      reports: [],
      good: 0,
      bad: 0,
      total: 0,
      reliability: 50, // start at 50%
      avgLatency: 0,
      lastReport: null,
    };
  }

  const config = data.configStats[key];

  // Add report
  const report = {
    userId,
    username,
    working,
    latency,
    speed,
    timestamp,
  };

  config.reports.push(report);

  // Keep only last 100 reports per config
  if (config.reports.length > 100) {
    config.reports = config.reports.slice(-100);
  }

  // Update stats
  config.total++;
  if (working) config.good++;
  else config.bad++;

  // Calculate reliability (weighted: recent reports matter more)
  const recentReports = config.reports.slice(-20);
  const recentGood = recentReports.filter(r => r.working).length;
  config.reliability = Math.round((recentGood / recentReports.length) * 100);

  // Update avg latency
  const latencies = config.reports.filter(r => r.latency && r.working).map(r => r.latency);
  if (latencies.length > 0) {
    config.avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }

  config.lastReport = timestamp;

  // Update top reporters
  if (!data.topReporters) data.topReporters = [];
  const reporter = data.topReporters.find(r => r.userId === userId);
  if (reporter) {
    reporter.reports++;
    reporter.lastReport = timestamp;
  } else {
    data.topReporters.push({
      userId,
      username,
      reports: 1,
      lastReport: timestamp,
    });
  }

  // Keep top 50 reporters
  data.topReporters.sort((a, b) => b.reports - a.reports);
  data.topReporters = data.topReporters.slice(0, 50);

  // Store report
  const reportKey = `${userId}_${timestamp}`;
  data.reports[reportKey] = report;

  // Keep only last 500 reports total
  const allReportKeys = Object.keys(data.reports).sort();
  if (allReportKeys.length > 500) {
    for (const k of allReportKeys.slice(0, allReportKeys.length - 500)) {
      delete data.reports[k];
    }
  }

  saveData(data);

  return {
    success: true,
    configReliability: config.reliability,
    totalReports: config.total,
    message: working
      ? `✅ گزارش ثبت شد! قابلیت اطمینان: ${config.reliability}% (${config.total} گزارش)`
      : `❌ گزارش ثبت شد. قابلیت اطمینان: ${config.reliability}%`,
  };
}

// ─── Get config reliability ───

export function getConfigReliability(host, port) {
  const data = loadData();
  const key = getConfigKey(host, port);
  return data.configStats[key] || null;
}

// ─── Get all config rankings ───

export function getConfigRankings() {
  const data = loadData();
  const configs = Object.values(data.configStats);

  configs.sort((a, b) => b.reliability - a.reliability || a.avgLatency - b.avgLatency);

  return configs.map((c, i) => ({
    rank: i + 1,
    host: c.host,
    port: c.port,
    reliability: c.reliability,
    avgLatency: c.avgLatency,
    good: c.good,
    bad: c.bad,
    total: c.total,
    lastReport: c.lastReport,
  }));
}

// ─── Get crowd test summary ───

export function getCrowdSummary() {
  const data = loadData();
  const configs = Object.values(data.configStats);
  const totalReports = Object.keys(data.reports).length;
  const totalConfigs = configs.length;
  const reliable = configs.filter(c => c.reliability >= 70).length;
  const unreliable = configs.filter(c => c.reliability < 30).length;
  const topReporters = (data.topReporters || []).slice(0, 5);

  return {
    totalReports,
    totalConfigs,
    reliable,
    unreliable,
    avgReliability: totalConfigs > 0
      ? Math.round(configs.reduce((a, b) => a + b.reliability, 0) / totalConfigs)
      : 0,
    topReporters,
  };
}

// ─── Format for Telegram ───

export function formatCrowdTestReport() {
  const summary = getCrowdSummary();
  const rankings = getConfigRankings();

  const lines = [
    '👥 <b>گزارش تست جمعی</b>',
    '',
    `📊 کل گزارش‌ها: <b>${summary.totalReports}</b>`,
    `🖥 سرورهای تست شده: <b>${summary.totalConfigs}</b>`,
    `✅ قابل اطمینان (≥70%): <b>${summary.reliable}</b>`,
    `❌ غیرقابل اطمینان (<30%): <b>${summary.unreliable}</b>`,
    `📈 میانگین قابلیت: <b>${summary.avgReliability}%</b>`,
  ];

  if (rankings.length > 0) {
    lines.push('', '🏆 <b>بهترین سرورها:</b>');
    for (const r of rankings.slice(0, 5)) {
      const flag = getFlag(r.host);
      const bar = '█'.repeat(Math.round(r.reliability / 10));
      lines.push(`${flag} <code>${r.host}:${r.port}</code>`);
      lines.push(`  📊 ${r.reliability}% ${bar} | ⚡ ${r.avgLatency || '?'}ms | 👍${r.good} 👎${r.bad}`);
    }
  }

  if (summary.topReporters.length > 0) {
    lines.push('', '🌟 <b>بهترین تسترها:</b>');
    for (const r of summary.topReporters) {
      lines.push(`  ${r.username || r.userId}: ${r.reports} گزارش`);
    }
  }

  return lines.join('\n');
}

export function formatReportConfirmation(result) {
  return `📊 <b>گزارش شما:</b>

${result.message}

💡 ممنون از مشارکتت! گزارش‌های شما به بقیه کمک می‌کنه.`;
}

function getFlag(host) {
  // Simple flag detection based on common IP ranges
  return '🌐';
}

export { loadData };
