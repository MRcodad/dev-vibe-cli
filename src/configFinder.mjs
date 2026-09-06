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
  'https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray',
  'https://raw.githubusercontent.com/erfan-f/v2ray-collector/main/sub/reality.txt'
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
  const spinner = ora('در حال جمع‌آوری تازه ترین کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      rawConfigs.push(...parseConfigs(res.data));
    } catch {}
  }

  rawConfigs = [...new Set(rawConfigs)];
  spinner.succeed(`مجموعاً ${rawConfigs.length} کانفیگ جدید استخراج شد.`);

  const finalConfigs = rawConfigs.slice(0, 100).map((cfg, idx) => renameConfig(cfg, idx));
  const plainText = finalConfigs.join('\n');
  const base64Sub = Buffer.from(plainText).toString('base64');

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // جلوگیری از بلاک شدن فایل‌ها توسط GitHub Pages / Jekyll
  fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

  // ذخیره خروجی‌ها
  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainText);

  // همچنین ذخیره فایل‌ها در ریشه جهت دسترسی مستقیم و آسان بدون مسیر dist
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(process.cwd(), 'sub_plain.txt'), plainText);

  console.log(chalk.green(`\n✅ آپدیت انجام شد! ${finalConfigs.length} کانفیگ تازه ثبت شد.`));
}