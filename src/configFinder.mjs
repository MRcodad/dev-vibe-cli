import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';
import { runTests } from './configTester.mjs';
import { filterConfigs } from './configFilter.mjs';

const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
  'https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector_Py/main/sub/Mix/mix.txt'
];

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

function safeRenameConfig(config, index) {
  const safeName = `Node-${String(index + 1).padStart(3, '0')}`;
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
      return `${baseUrl}#${safeName}`;
    }
  } catch {
    return null;
  }
}

function generateResultsJson(finalConfigs, testedResults, totalFetched, totalUnique) {
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
      passedFilter: finalConfigs.length,
    },
    byCountry,
    byProtocol,
    configs: testedResults.map(r => ({
      protocol: r.protocol,
      host: r.host,
      port: r.port,
      country: r.country,
      alive: r.alive,
      tlsOk: r.tlsOk,
      latency: r.latency,
      score: r.score || 0,
    })),
  };
}

// --- Main workflow: collect only (no testing) ---
export async function runFetchWorkflow() {
  const spinner = ora('در حال دریافت کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.status === 200 && res.data) {
        const parsed = parseRawConfigs(res.data);
        if (parsed.length > 0) rawConfigs.push(...parsed);
      }
    } catch {
      continue;
    }
  }

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
    const cleaned = safeRenameConfig(cfg, count);
    if (cleaned) { cleanedConfigs.push(cleaned); count++; }
  }

  spinner.succeed(`${rawConfigs.length} خام → ${uniqueConfigs.length} یکتا → ${cleanedConfigs.length} نهایی`);

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
  const fetchSpinner = ora('مرحله ۱/۴: دریافت کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.status === 200 && res.data) {
        const parsed = parseRawConfigs(res.data);
        if (parsed.length > 0) rawConfigs.push(...parsed);
      }
    } catch {
      continue;
    }
  }

  if (rawConfigs.length === 0) {
    fetchSpinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  // Step 2: Dedup
  fetchSpinner.text = 'مرحله ۲/۴: حذف تکرارها...';
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

  const configsToTest = uniqueConfigs.slice(0, 300);
  fetchSpinner.succeed(`${rawConfigs.length} خام → ${uniqueConfigs.length} یکتا → ${configsToTest.length} برای تست`);

  // Step 3: Test
  const testSpinner = ora('مرحله ۳/۴: تست شبکه (TCP + TLS + Speed)...').start();
  const testedResults = await runTests(configsToTest, (tested, total) => {
    testSpinner.text = `مرحله ۳/۴: تست شبکه... ${tested}/${total}`;
  });

  const aliveCount = testedResults.filter(r => r.alive).length;
  const tlsCount = testedResults.filter(r => r.tlsOk).length;
  testSpinner.succeed(`تست تمام شد: ${aliveCount} زنده | ${tlsCount} TLS موفق`);

  // Step 4: Filter
  const filterSpinner = ora('مرحله ۴/۴: فیلتر هوشمند...').start();
  const filtered = await filterConfigs(testedResults, {
    countryInclude,
    countryExclude,
    minScore,
    maxLatency,
    fastMode,
    onProgress: (msg) => {
      if (msg === 'country') filterSpinner.text = 'مرحله ۴/۴: تشخیص کشور سرورها...';
    },
  });

  const renamed = filtered.map((cfg, i) => safeRenameConfig(cfg.raw, i)).filter(Boolean);
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
  console.log(chalk.white(`  تست شده: ${testedResults.length} | زنده: ${aliveCount} | TLS: ${tlsCount}`));
  console.log(chalk.green(`  نهایی: ${renamed.length}`));
  console.log(chalk.cyan('  پروتکل:'), protocolStats);
  if (Object.keys(countryStats).length > 0) {
    console.log(chalk.cyan('  کشور:'), countryStats);
  }

  // Write output
  writeOutput(renamed);

  // Write results.json
  const distDir = path.join(process.cwd(), 'dist');
  const resultsJson = generateResultsJson(renamed, filtered, rawConfigs.length, uniqueConfigs.length);
  fs.writeFileSync(path.join(distDir, 'results.json'), JSON.stringify(resultsJson, null, 2), 'utf-8');
}

function writeOutput(configs) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#00-UPDATE-SUB-LINK`;
  const finalConfigs = [dummyInfoServer, ...configs];

  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(distDir, 'sub_plain.txt'), plainText, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\nساب‌لینک جدید با ${configs.length} کانفیگ ساخته شد.`));
}
