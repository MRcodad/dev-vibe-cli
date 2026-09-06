import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/reality/mix',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/vless/mix',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt',
  'https://raw.githubusercontent.com/freefq/free/master/v2',
  'https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray'
];

function parseConfigs(rawData) {
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
  const spinner = ora('در حال جمع‌آوری تازه‌ترین کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      rawConfigs.push(...parseConfigs(res.data));
    } catch {}
  }

  rawConfigs = [...new Set(rawConfigs)];
  
  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی یافت نشد!');
    return;
  }

  spinner.succeed(`مجموعاً ${rawConfigs.length} کانفیگ استخراج شد.`);

  const finalConfigs = rawConfigs.slice(0, 80).map((cfg, idx) => renameConfig(cfg, idx));
  
  // ساخت رشته متنی بدون خط‌های خالی اضافی
  const plainText = finalConfigs.join('\n').trim();
  
  // کدگذاری دقیق Base64
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // ایجاد فایل .nojekyll
  fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

  // ذخیره فایل‌های خروجی
  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainText, 'utf-8');

  console.log(chalk.green(`\n✅ فایل‌های sub.txt و sub_plain.txt با موفقیت ساخته شدند.`));
}