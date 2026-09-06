import fs from 'fs';
import path from 'path';
import net from 'net';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

// ۱۰ سورس غنی برای دریافت بیش از ۱۰,۰۰۰ کانفیگ
const SOURCES = [
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix',
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
  'https://raw.githubusercontent.com/morteza45/v2ray-starter/main/config.txt',
  'https://raw.githubusercontent.com/L12248/v2ray-share/main/v2ray',
  'https://raw.githubusercontent.com/EbrahimAharizadeh/v2ray-subscription/main/sub/mix',
  'https://raw.githubusercontent.com/soroushmirzaei/telegram-v2ray-configs/main/sub/mixed',
  'https://raw.githubusercontent.com/ts-indexer/sub-collector/main/sub/mixed',
  'https://raw.githubusercontent.com/mhsanaei/3x-ui/master/sub/mix',
  'https://raw.githubusercontent.com/freefq/free/master/v2'
];

// تغییر نام کانفیگ‌ها به برند MRCODAD
function renameConfig(config, index) {
  const customName = `⚡ MRCODAD | #${index + 1}`;
  
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '');
      const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonStr);
      parsed.ps = customName;
      const updatedBase64 = Buffer.from(JSON.stringify(parsed)).toString('base64');
      return `vmess://${updatedBase64}`;
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

// تجزیه آدرس آی‌پی و پورت از انواع کانفیگ‌ها
function parseConfigHostPort(config) {
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '');
      const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonStr);
      return { host: parsed.add, port: parseInt(parsed.port, 10) };
    } else {
      const urlPart = config.split('@')[1];
      if (!urlPart) return null;
      const hostPortStr = urlPart.split('?')[0].split('#')[0];
      const [host, port] = hostPortStr.split(':');
      return { host, port: parseInt(port, 10) };
    }
  } catch {
    return null;
  }
}

// تست پینگ سریع TCP
function testTcpConnection(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    if (!host || !port || isNaN(port)) return resolve(false);

    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

function parseConfigs(rawData) {
  const lines = rawData.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines.filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال دریافت کانفیگ‌ها از ۱۰ سورس عمده...').start();
  let allConfigs = [];

  for (const url of SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      const parsed = parseConfigs(res.data);
      allConfigs.push(...parsed);
    } catch (e) {
      // ادامه با سورس بعدی در صورت خطا
    }
  }

  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد.');
    return;
  }

  spinner.succeed(`مجموعاً ${allConfigs.length} کانفیگ یکتا استخراج شد!`);
  console.log(chalk.yellow('\nدر حال تست پینگ سریع TCP و تغییر نام به برند MRCODAD...'));

  const activeConfigs = [];
  const maxTestLimit = Math.min(allConfigs.length, 300); // تست پینگ ۳۰۰ کانفیگ اول برای سرعت بالای اکشن

  for (let i = 0; i < maxTestLimit; i++) {
    const rawConfig = allConfigs[i];
    const target = parseConfigHostPort(rawConfig);

    if (target) {
      const isAlive = await testTcpConnection(target.host, target.port);
      if (isAlive) {
        // تغییر نام کانفیگ زنده به MRCODAD
        const renamedConfig = renameConfig(rawConfig, activeConfigs.length);
        activeConfigs.push(renamedConfig);
      }
    }
  }

  console.log(chalk.green(`\nتعداد ${activeConfigs.length} کانفیگ سالم با نام MRCODAD آماده شد!`));

  if (activeConfigs.length === 0) {
    console.log(chalk.red('سرور زنده‌ای یافت نشد.'));
    return;
  }

  // رمزنگاری Base64 استاندارد
  const plainTextConfigs = activeConfigs.join('\n');
  const base64Sub = Buffer.from(plainTextConfigs).toString('base64');

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainTextConfigs);

  console.log(chalk.cyan(`\nفایل‌های سابسکریپشن با موفقیت در پوشه dist به‌روزرسانی شدند.`));
}