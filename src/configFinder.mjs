import fs from 'fs';
import path from 'path';
import net from 'net';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

// سورس‌های بسیار معتبر با به‌روزرسانی زیر ۱۵ دقیقه
const SOURCES = [
  'https://raw.githubusercontent.com/0xRadikal/Free-v2ray-Configs/main/verified/configs.txt',
  'https://raw.githubusercontent.com/ebrasha/free-v2ray-public-list/main/all_extracted_configs.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
  'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Sub26.txt',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix',
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
  'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt'
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

function testTcpConnection(host, port, timeout = 1800) {
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
  let text = rawData;
  // بررسی اینکه آیا سورس خودش Base64 است یا خیر
  if (!text.includes('vless://') && !text.includes('vmess://') && !text.includes('trojan://') && !text.includes('ss://')) {
    try {
      text = Buffer.from(rawData, 'base64').toString('utf-8');
    } catch {
      // ادامه با متن اولیه
    }
  }
  const lines = text.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines.filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال جمع‌آوری از سورس‌های زنده V2Ray...').start();
  let allConfigs = [];

  for (const url of SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 10000 });
      const parsed = parseConfigs(res.data);
      allConfigs.push(...parsed);
    } catch (e) {
      // ادامه با سورس بعدی
    }
  }

  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد.');
    return;
  }

  spinner.succeed(`تعداد ${allConfigs.length} کانفیگ استخراج شد.`);
  console.log(chalk.yellow('\nدر حال غربالگری کانفیگ‌های پاسخ‌گو و اعمال نام MRCODAD...'));

  const activeConfigs = [];
  const testLimit = Math.min(allConfigs.length, 500);

  for (let i = 0; i < testLimit; i++) {
    const rawConfig = allConfigs[i];
    const target = parseConfigHostPort(rawConfig);

    if (target) {
      const isAlive = await testTcpConnection(target.host, target.port);
      if (isAlive) {
        const renamedConfig = renameConfig(rawConfig, activeConfigs.length);
        activeConfigs.push(renamedConfig);
      }
    }
  }

  console.log(chalk.green(`\nتعداد ${activeConfigs.length} کانفیگ فعال و سالم آماده گردید.`));

  if (activeConfigs.length === 0) {
    console.log(chalk.red('سرور فعالی در این لحظه یافت نشد.'));
    return;
  }

  const plainTextConfigs = activeConfigs.join('\n');
  const base64Sub = Buffer.from(plainTextConfigs).toString('base64');

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainTextConfigs);

  console.log(chalk.cyan(`\nفایل‌های سابسکریپشن با موفقیت در پوشه dist به‌روزرسانی شدند.`));
}