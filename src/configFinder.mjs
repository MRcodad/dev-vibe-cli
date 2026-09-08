import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';
import { SUBSCRIPTION_SOURCES } from './sources.mjs';
import { runTests } from './configTester.mjs';
import { filterConfigs } from './configFilter.mjs';
import { generateDashboard, generateApiFiles } from './dashboard.mjs';
import { sendTelegramNotification } from './telegram.mjs';
import { updateHealth, getHealthStats } from './health.mjs';
import { getCountryFlag, getCountryName, formatServerName } from './country.mjs';
import { analyzeCensorship, getCensorSummary } from './antiCensor.mjs';
import { runBatchSpeedTest, formatSpeed } from './speedTest.mjs';
import { getGlobalStats } from './gamification.mjs';
import { performFailover, formatFailoverReport } from './autoFailover.mjs';
import { generateUptimeReport, formatUptimeReport, generateUptimeHTML } from './uptimeReport.mjs';

function parseRawConfigs(rawData) {
  if (!rawData || typeof rawData !== 'string') return [];
  let text = rawData;
  if (!text.includes('vless://') && !text.includes('vmess://') && !text.includes('trojan://') && !text.includes('ss://')) {
    try {
      text = Buffer.from(rawData.trim(), 'base64').toString('utf-8');
    } catch {}
  }
  const lines = text.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines
    .map(l => l.trim())
    .filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

function getUniqueKey(config) {
  try {
    return config.split('#')[0].trim();
  } catch {}
  return config;
}

function safeRenameConfig(config, index, countryCode, protocol) {
  const safeName = formatServerName(index, countryCode, protocol);
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '').trim();
      const decoded = Buffer.from(base64Str, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      parsed.ps = safeName;
      const reEncoded = Buffer.from(JSON.stringify(parsed), 'utf-8').toString('base64');
      return `vmess://${reEncoded}`;
    } else {
      const hashIndex = config.indexOf('#');
      const baseUrl = hashIndex !== -1 ? config.substring(0, hashIndex) : config;
      return `${baseUrl}#${encodeURIComponent(safeName)}`;
    }
  } catch {
    return null;
  }
}

async function fetchAllConfigs(spinner) {
  let rawConfigs = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < SUBSCRIPTION_SOURCES.length; i++) {
    const url = SUBSCRIPTION_SOURCES[i];
    const sourceName = url.split('/').slice(-3, -1).join('/');
    spinner.text = `دریافت منابع... (${i + 1}/${SUBSCRIPTION_SOURCES.length}) ${sourceName}`;
    try {
      const res = await axios.get(url, {
        timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.status === 200 && res.data) {
        const parsed = parseRawConfigs(res.data);
        if (parsed.length > 0) {
          rawConfigs.push(...parsed);
          successCount++;
        }
      }
    } catch {
      failCount++;
      continue;
    }
  }

  return { rawConfigs, successCount, failCount };
}

function generateResultsJson(filteredConfigs, testedResults, totalFetched, totalUnique) {
  const byCountry = {};
  const byProtocol = {};

  for (const cfg of testedResults) {
    if (cfg.country) byCountry[cfg.country] = (byCountry[cfg.country] || 0) + 1;
    const pKey = cfg.protocol || 'unknown';
    byProtocol[pKey] = (byProtocol[pKey] || 0) + 1;
  }

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalFetched,
      totalUnique,
      tested: testedResults.length,
      alive: testedResults.filter(r => r.alive).length,
      tlsOk: testedResults.filter(r => r.tlsOk).length,
      vlessOk: testedResults.filter(r => r.vlessOk).length,
      passedFilter: filteredConfigs.length,
    },
    byCountry,
    byProtocol,
    configs: testedResults.map(r => ({
      protocol: r.protocol,
      host: r.host,
      port: r.port,
      country: r.country,
      flag: r.country ? getCountryFlag(r.country) : '🌐',
      countryName: r.country ? getCountryName(r.country) : 'نامشخص',
      alive: r.alive,
      tlsOk: r.tlsOk,
      vlessOk: r.vlessOk || false,
      latency: r.latency,
      score: r.score || 0,
    })),
  };
}

// --- Main workflow: collect only (no testing) ---
export async function runFetchWorkflow() {
  const spinner = ora('در حال دریافت کانفیگ‌ها...').start();
  const { rawConfigs, successCount, failCount } = await fetchAllConfigs(spinner);

  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  const vlessConfigs = rawConfigs.filter(c => c.startsWith('vless://'));
  const otherConfigs = rawConfigs.filter(c => !c.startsWith('vless://'));
  const sorted = [...vlessConfigs, ...otherConfigs];

  const uniqueConfigs = [];
  const seenKeys = new Set();
  for (const cfg of sorted) {
    const key = getUniqueKey(cfg);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueConfigs.push(cfg);
    }
  }

  const cleanedConfigs = [];
  let count = 0;
  for (const cfg of uniqueConfigs) {
    if (count >= 300) break;
    const cleaned = safeRenameConfig(cfg, count, null, null);
    if (cleaned) { cleanedConfigs.push(cleaned); count++; }
  }

  spinner.succeed(`${rawConfigs.length} خام (${successCount} منبع) → ${uniqueConfigs.length} یکتا → ${cleanedConfigs.length} نهایی`);

  writeOutput(cleanedConfigs);
}

// --- Main workflow: test + filter ---
export async function runTestWorkflow(options = {}) {
  const {
    countryInclude = null,
    countryExclude = null,
    minScore = 30,
    maxLatency = 2000,
    fastMode = false,
  } = options;

  // Step 1: Fetch
  const fetchSpinner = ora('مرحله ۱/۹: دریافت کانفیگ‌ها...').start();
  const { rawConfigs, successCount, failCount } = await fetchAllConfigs(fetchSpinner);

  if (rawConfigs.length === 0) {
    fetchSpinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  // Step 2: Dedup
  fetchSpinner.text = 'مرحله ۲/۹: حذف تکرارها...';
  const vlessConfigs = rawConfigs.filter(c => c.startsWith('vless://'));
  const otherConfigs = rawConfigs.filter(c => !c.startsWith('vless://'));
  const sorted = [...vlessConfigs, ...otherConfigs];

  const uniqueConfigs = [];
  const seenKeys = new Set();
  for (const cfg of sorted) {
    const key = getUniqueKey(cfg);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueConfigs.push(cfg);
    }
  }

  const configsToTest = uniqueConfigs.slice(0, 500);
  fetchSpinner.succeed(`${rawConfigs.length} خام (${successCount}/${SUBSCRIPTION_SOURCES.length} منبع) → ${uniqueConfigs.length} یکتا → ${configsToTest.length} برای تست`);

  // Step 3: Test
  const testSpinner = ora('مرحله ۳/۹: تست شبکه (TCP + TLS + Speed)...').start();
  const testedResults = await runTests(configsToTest, (tested, total) => {
    testSpinner.text = `مرحله ۳/۹: تست شبکه... ${tested}/${total}`;
  });

  const aliveCount = testedResults.filter(r => r.alive).length;
  const tlsCount = testedResults.filter(r => r.tlsOk).length;
  testSpinner.succeed(`تست تمام شد: ${aliveCount} زنده | ${tlsCount} TLS موفق`);

  // Step 4: Filter
  const filterSpinner = ora('مرحله ۴/۹: فیلتر هوشمند...').start();
  const filtered = await filterConfigs(testedResults, {
    countryInclude,
    countryExclude,
    minScore,
    maxLatency,
    fastMode,
    onProgress: (msg) => {
      if (msg === 'country') filterSpinner.text = 'مرحله ۴/۵: تشخیص کشور سرورها...';
    },
  });

  // Step 5: Health tracking
  const healthSpinner = ora('مرحله ۵/۹: بروزرسانی تاریخچه سلامت...').start();
  const health = updateHealth(testedResults);
  const healthStats = getHealthStats(health);
  healthSpinner.succeed(`تاریخچه بروزرسانی شد: ${healthStats.healthyServers} سالم | ${healthStats.unstableServers} ناپایدار | ${healthStats.deadServers} مرده`);

  // Step 6: Anti-censorship analysis
  const censorSpinner = ora('مرحله ۶/۹: تحلیل ضد سانسور...').start();
  const censorResults = await analyzeCensorship(filtered, (done, total) => {
    censorSpinner.text = `مرحله ۶/۹: تحلیل ضد سانسور... ${done}/${total}`;
  });
  const censorSummary = getCensorSummary(censorResults);
  censorSpinner.succeed(`تحلیل ضد سانسور: ${censorSummary.accessible} قابل دسترس | ${censorSummary.likelyBlocked} احتمالاً مسدود | میانگین امتیاز: ${censorSummary.avgCensorScore}`);

  // Step 7: Speed estimation
  const speedSpinner = ora('مرحله ۷/۹: تخمین سرعت...').start();
  const topConfigs = filtered.slice(0, 20);
  const speedResults = await runBatchSpeedTest(topConfigs, (done, total) => {
    speedSpinner.text = `مرحله ۷/۹: تست سرعت... ${done}/${total}`;
  }, 5);
  const fastServers = speedResults.filter(s => s.avgSpeed > 0).length;
  const bestSpeed = speedResults.reduce((max, s) => Math.max(max, s.avgSpeed), 0);
  speedSpinner.succeed(`سرعت: ${fastServers} سرور تست شد | بهترین: ${formatSpeed(bestSpeed)}`);

  // Step 8: Auto-Failover
  const failoverSpinner = ora('مرحله ۸/۹: بررسی Auto-Failover...').start();
  const failoverResult = performFailover(filtered);
  failoverSpinner.succeed(failoverResult.message);

  // Step 9: Uptime Report
  const reportSpinner = ora('مرحله ۹/۹: تولید گزارش آپتایم...').start();
  const uptimeReport = generateUptimeReport();
  const uptimeHTML = generateUptimeHTML(uptimeReport);
  fs.writeFileSync(path.join(process.cwd(), 'dist', 'uptime-report.html'), uptimeHTML, 'utf-8');
  reportSpinner.succeed(`گزارش آپتایم: ${uptimeReport.summary?.totalServers || 0} سرور | آپتایم: ${uptimeReport.summary?.avgUptime24h || 0}%`);

  // Rename with MRCODAD branding + country flag
  const renamed = filtered.map((cfg, i) => safeRenameConfig(cfg.raw, i, cfg.country, cfg.protocol)).filter(Boolean);
  filterSpinner.succeed(`فیلتر نهایی: ${renamed.length} کانفیگ با کیفیت بالا`);

  // Stats
  const countryStats = {};
  const protocolStats = {};
  for (const cfg of filtered) {
    if (cfg.country) countryStats[cfg.country] = (countryStats[cfg.country] || 0) + 1;
    const p = cfg.protocol || 'unknown';
    protocolStats[p] = (protocolStats[p] || 0) + 1;
  }

  console.log(chalk.cyan('\n--- آمار نهایی ---'));
  console.log(chalk.white(`  خام: ${rawConfigs.length} | یکتا: ${uniqueConfigs.length}`));
  const vlessCount = testedResults.filter(r => r.vlessOk).length;
  console.log(chalk.white(`  تست شده: ${testedResults.length} | زنده: ${aliveCount} | TLS: ${tlsCount} | VLESS: ${vlessCount}`));
  console.log(chalk.green(`  نهایی: ${renamed.length}`));
  console.log(chalk.cyan('  پروتکل:'), protocolStats);
  if (Object.keys(countryStats).length > 0) {
    console.log(chalk.cyan('  کشور:'), countryStats);
  }

  // Generate outputs
  writeOutput(renamed);

  const resultsJson = generateResultsJson(renamed, filtered, rawConfigs.length, uniqueConfigs.length);
  resultsJson.health = {
    totalServers: healthStats.totalServers,
    healthyServers: healthStats.healthyServers,
    unstableServers: healthStats.unstableServers,
    deadServers: healthStats.deadServers,
    avgUptime24h: healthStats.avgUptime24h,
    avgUptime7d: healthStats.avgUptime7d,
  };
  resultsJson.censor = censorSummary;
  resultsJson.speeds = speedResults.filter(s => s.tlsOk).map(s => ({
    host: s.host, port: s.port, avgSpeed: s.avgSpeed, tlsLatency: s.tlsLatency, grade: s.grade,
  }));
  resultsJson.gamification = getGlobalStats();
  resultsJson.failover = {
    changed: failoverResult.changed,
    removed: failoverResult.removed,
    added: failoverResult.added,
  };
  resultsJson.uptimeReport = {
    generated: uptimeReport.generated,
    summary: uptimeReport.summary,
    bestServers: uptimeReport.bestServers,
    worstServers: uptimeReport.worstServers,
    byCountry: uptimeReport.byCountry,
  };
  generateDashboard(resultsJson);
  generateApiFiles(filtered);

  // Telegram notification
  await sendTelegramNotification(resultsJson.summary);

  // Send failover notification if there were changes
  if (failoverResult.changed) {
    await sendTelegramNotification({
      ...resultsJson.summary,
      failoverMessage: formatFailoverReport(failoverResult),
    });
  }
}

function writeOutput(configs) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#00-%D8%A2%D9%BE%D8%AF%DB%8C%D8%AA-%DA%A9%D9%86%DB%8C%D8%AF-%D8%A7%D8%B2-%D8%B7%D8%B1%DB%8C%D9%82-%D8%A8%D8%A7%D8%B2%D8%B1%D8%B3%D8%A7%D9%86%DB%8C`;
  const finalConfigs = [dummyInfoServer, ...configs];

  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'sub_plain.txt'), plainText, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\nساب‌لینک جدید با ${configs.length} کانفیگ ساخته شد.`));
}
