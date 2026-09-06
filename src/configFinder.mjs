import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/main/V2Ray-Config-By-EbraSha-All-Type.txt',
  'https://raw.githubusercontent.com/iboxz/free-v2ray-collector/main/sub/mix.txt',
  'https://raw.githubusercontent.com/MohammadBahemmat/V2ray-Collector/main/sub/mix.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub3.txt',
  'https://raw.githubusercontent.com/mrvcoder/V2rayCollector/master/sub/mix.txt',
  'https://raw.githubusercontent.com/freefq/free/master/v2'
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
  const spinner = ora('در حال استخراج کانفیگ‌های زنده...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const parsed = parseConfigs(res.data);
      if (parsed.length > 0) {
        rawConfigs.push(...parsed);
      }
    } catch (e) {}
  }

  rawConfigs = [...new Set(rawConfigs)];
  
  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  spinner.succeed(`مجموعاً ${rawConfigs.length} کانفیگ استخراج شد.`);

  // ۱. ساخت سرور راهنمای غیرفعال در بالاترین ردیف
  const infoNoticeName = encodeURIComponent('⚠️ قبل از اتصال لینک را آپدیت کنید');
  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#${infoNoticeName}`;

  // ۲. تغییر نام بقیه سرورها
  const renamedConfigs = rawConfigs.slice(0, 100).map((cfg, idx) => renameConfig(cfg, idx));

  // ۳. ترکیب سرور راهنما با سرورهای اصلی
  const finalConfigs = [dummyInfoServer, ...renamedConfigs];

  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\n✅ سرور راهنما اضافه شد و فایل‌ها به‌روزرسانی گردیدند.`));
}