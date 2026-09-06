import fs from 'fs';
import path from 'path';
import net from 'net';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const SOURCES = [
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix',
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt'
];

// تجزیه آدرس آی‌پی و پورت از لینک‌های vless / vmess / trojan / ss
function parseConfigHostPort(config) {
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '');
      const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
      const parsed = JSON.parse(jsonStr);
      return { host: parsed.add, port: parseInt(parsed.port, 10) };
    } else {
      // برای vless, trojan, ss
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

// تست پینگ واقعی TCP به آی‌پی و پورت سرور
function testTcpConnection(host, port, timeout = 2500) {
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
  const spinner = ora('در حال دریافت آخرین کانفیگ‌های زنده...').start();
  let allConfigs = [];

  for (const url of SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      const parsed = parseConfigs(res.data);
      allConfigs.push(...parsed);
    } catch (e) {
      // ادامه با سورس بعدی
    }
  }

  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی از سورس‌ها دریافت نشد.');
    return;
  }

  spinner.succeed(`تعداد ${allConfigs.length} کانفیگ دریافت شد.`);
  console.log(chalk.yellow('\nشروع تست پینگ واقعی TCP روی سرورها...'));

  const activeConfigs = [];
  const limit = Math.min(allConfigs.length, 100); // تست ۱۰۰ کانفیگ اول

  for (let i = 0; i < limit; i++) {
    const config = allConfigs[i];
    const target = parseConfigHostPort(config);

    if (target) {
      const isAlive = await testTcpConnection(target.host, target.port);
      if (isAlive) {
        activeConfigs.push(config);
      }
    }
  }

  console.log(chalk.green(`\nتعداد ${activeConfigs.length} سرور زنده و پاسخ‌گو تایید شدند!`));

  if (activeConfigs.length === 0) {
    console.log(chalk.red('هیچ سرور زنده‌ای پیدا نشد. دوباره تلاش کنید.'));
    return;
  }

  // ساخت لینک سابسکریپشن واقعی استاندارد (Base64)
  const plainTextConfigs = activeConfigs.join('\n');
  const base64Sub = Buffer.from(plainTextConfigs).toString('base64');

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainTextConfigs);

  console.log(chalk.cyan(`\nلینک سابسکریپشن واقعی در dist/sub.txt ذخیره شد.`));
}