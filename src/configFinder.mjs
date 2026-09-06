import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

// سورس‌های بسیار معتبر با هدرهای اختصاصی
const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/reality/mix',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/vless/mix',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt',
  'https://raw.githubusercontent.com/MrMohebi/xray-proxy-grabber-telegram/master/collected-proxies/row-url/configs.txt',
  'https://raw.githubusercontent.com/bikhedmat/v2ray-collector/main/sub/mix'
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
  const spinner = ora('در حال جمع‌آوری کانفیگ‌های تازه و سالم...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      // اضافه کردن هدر User-Agent برای جلوگیری از بلاک شدن درخواست توسط گیت‌هاب
      const res = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const parsed = parseConfigs(res.data);
      if (parsed.length > 0) {
        rawConfigs.push(...parsed);
      }
    } catch (e) {
      // در صورت خطا در یک سورس، ادامه می‌دهد
    }
  }

  rawConfigs = [...new Set(rawConfigs)];
  
  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد! لطفاً دوباره تلاش کنید.');
    return;
  }

  spinner.succeed(`مجموعاً ${rawConfigs.length} کانفیگ استخراج شد.`);

  const finalConfigs = rawConfigs.slice(0, 100).map((cfg, idx) => renameConfig(cfg, idx));
  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  // ذخیره فایل‌ها در هر دو مسیر جهت اطمینان
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\n✅ ${finalConfigs.length} کانفیگ تازه و بدون خطا ثبت شد.`));
}