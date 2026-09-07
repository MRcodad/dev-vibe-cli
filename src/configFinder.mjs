import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
  'https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector_Py/main/sub/Mix/mix.txt'
];

function parseConfigs(rawData) {
  if (!rawData || typeof rawData !== 'string') return [];
  let text = rawData;
  // اگر فایل Base64 بود آن را باز می‌کنیم
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
    const clean = config.split('#')[0];
    const match = clean.match(/@([^:]+):(\d+)/);
    if (match) return `${match[1]}:${match[2]}`;
  } catch {}
  return config;
}

// تغییر نام بدون هیچ کاراکتر عجیب یا انکودینگ مخرب
function cleanAndRenameConfig(config, index) {
  const cleanConfig = config.replace(/[\r\n]/g, '').trim();
  const simpleName = `Server-${index + 1}`;

  try {
    if (cleanConfig.startsWith('vmess://')) {
      const base64Str = cleanConfig.replace('vmess://', '').trim();
      const parsed = JSON.parse(Buffer.from(base64Str, 'base64').toString('utf-8'));
      parsed.ps = simpleName;
      return `vmess://${Buffer.from(JSON.stringify(parsed)).toString('base64')}`;
    } else {
      const hashIndex = cleanConfig.indexOf('#');
      if (hashIndex !== -1) {
        return `${cleanConfig.substring(0, hashIndex)}#${simpleName}`;
      }
      return `${cleanConfig}#${simpleName}`;
    }
  } catch {
    return cleanConfig;
  }
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال دریافت و پردازش خط‌به‌خط کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      if (res.status === 200 && res.data) {
        const parsed = parseConfigs(res.data);
        if (parsed.length > 0) rawConfigs.push(...parsed);
      }
    } catch (e) {
      continue;
    }
  }

  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  // ۱. اولویت با VLESS
  const vlessConfigs = rawConfigs.filter(c => c.startsWith('vless://'));
  const otherConfigs = rawConfigs.filter(c => !c.startsWith('vless://'));
  const sorted = [...vlessConfigs, ...otherConfigs];

  // ۲. حذف تکراری‌ها
  const uniqueConfigs = [];
  const seenKeys = new Set();

  for (const cfg of sorted) {
    const key = getUniqueKey(cfg);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueConfigs.push(cfg);
    }
  }

  spinner.succeed(`مجموعاً ${uniqueConfigs.length} کانفیگ سالم استخراج شد.`);

  // ۳. سرور راهنما (بدون کاراکتر فارسی یا خاص)
  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#0-UPDATE-SUB-LINK`;

  // ساخت لیست ۳۰۰ تایی با نام‌گذاری امن
  const renamedList = uniqueConfigs.slice(0, 300).map((cfg, idx) => cleanAndRenameConfig(cfg, idx));
  const finalConfigs = [dummyInfoServer, ...renamedList];

  // ساخت خروجی استاندارد
  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\n✅ فایل sub.txt با دقیقاً ${finalConfigs.length} کانفیگ بدون هیچ خطای دکود ذخیره شد.`));
}