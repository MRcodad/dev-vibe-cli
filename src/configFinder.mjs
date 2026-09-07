import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

// سورس‌های بسیار جامع و اختصاصی پروتکل‌های VLESS و REALITY
const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/mix',
  'https://raw.githubusercontent.com/MohammadBahemmat/V2ray-Collector/main/sub/mix.txt',
  'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/main/V2Ray-Config-By-EbraSha-All-Type.txt',
  'https://raw.githubusercontent.com/iboxz/free-v2ray-collector/main/sub/mix.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub3.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub4.txt',
  'https://raw.githubusercontent.com/mrvcoder/V2rayCollector/master/sub/mix.txt',
  'https://raw.githubusercontent.com/mft0/v2ray-collector/main/sub/reality.txt'
];

function parseConfigs(rawData) {
  if (!rawData || typeof rawData !== 'string') return [];
  let text = rawData;
  if (!text.includes('vless://') && !text.includes('vmess://') && !text.includes('trojan://') && !text.includes('ss://')) {
    try {
      text = Buffer.from(rawData.trim(), 'base64').toString('utf-8');
    } catch {}
  }
  const lines = text.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines.map(l => l.trim()).filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

function getUniqueKey(config) {
  try {
    const clean = config.split('#')[0];
    const match = clean.match(/@([^:]+):(\d+)/);
    if (match) return `${match[1]}:${match[2]}`;
  } catch {}
  return config;
}

function renameConfig(config, index) {
  const customName = `⚡ MRCODAD | #${index + 1}`;
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '').trim();
      const parsed = JSON.parse(Buffer.from(base64Str, 'base64').toString('utf-8'));
      parsed.ps = customName;
      return `vmess://${Buffer.from(JSON.stringify(parsed)).toString('base64')}`;
    } else if (config.startsWith('vless://') || config.startsWith('trojan://') || config.startsWith('ss://')) {
      const hashIndex = config.indexOf('#');
      if (hashIndex !== -1) {
        return `${config.substring(0, hashIndex)}#${encodeURIComponent(customName)}`;
      }
      return `${config}#${encodeURIComponent(customName)}`;
    }
  } catch {
    return config;
  }
  return config;
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال جمع‌آوری حداکثری کانفیگ‌های زنده...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const parsed = parseConfigs(res.data);
      if (parsed.length > 0) rawConfigs.push(...parsed);
    } catch (e) {}
  }

  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی یافت نشد!');
    return;
  }

  // اولویت مطلق با VLESS و REALITY
  const vlessConfigs = rawConfigs.filter(c => c.startsWith('vless://'));
  const otherConfigs = rawConfigs.filter(c => !c.startsWith('vless://'));
  const sorted = [...vlessConfigs, ...otherConfigs];

  // حذف تکراری‌ها بر اساس IP:Port
  const uniqueConfigs = [];
  const seenKeys = new Set();

  for (const cfg of sorted) {
    const key = getUniqueKey(cfg);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueConfigs.push(cfg);
    }
  }

  spinner.succeed(`تعداد ${uniqueConfigs.length} کانفیگ یکتا جدا گردید.`);

  // سرور راهنمای غیرفعال
  const infoNoticeName = encodeURIComponent('⚠️ قبل از اتصال لینک را آپدیت کنید');
  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#${infoNoticeName}`;

  // انتخاب تا ۲۵۰ کانفیگ برای افزایش شانس اتصال
  const finalConfigs = [
    dummyInfoServer,
    ...uniqueConfigs.slice(0, 250).map((cfg, idx) => renameConfig(cfg, idx))
  ];

  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\n✅ ۲۵۰ کانفیگ جدید در sub.txt قرار گرفت.`));
}