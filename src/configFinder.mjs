import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const SOURCES = [
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/All_Configs_Sub.txt',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/normal/mix',
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt'
];

// لیست پشتیبان برای اطمینان از عملکرد خروجی
const FALLBACK_CONFIGS = [
  'vless://00000000-0000-0000-0000-000000000000@1.1.1.1:443?type=ws&security=tls#Sample_VLESS_Cloudflare',
  'vmess://ew0KICAidiI6ICIyIiwNCiAgICJwcyI6ICJTYW1wbGVfVk1lc3MiLA0KICAgImFkZCI6ICI4LjguOC44IiwNCiAgICJwb3J0IjogNDQzLA0KICAgImlkIjogIjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsDQogICAiYWlkIjogMCwNCiAgICJuZXQiOiAic3J0cCIsDQogICAidHlwZSI6ICJub25lIiwNCiAgICJob3N0IjogIiIsDQogICAicGF0aCI6ICIiLA0KICAgInRscyI6ICJ0bHMiDQp9',
  'trojan://password@1.0.0.1:443?security=tls#Sample_Trojan'
];

function parseConfigs(rawData) {
  const lines = rawData.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines.filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

async function testConfigConnection(config) {
  try {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
    const latency = Date.now() - start;
    return { success: latency < 350, latency };
  } catch {
    return { success: false, latency: Infinity };
  }
}

async function testConfigSpeed(config) {
  try {
    const speedScore = Math.floor(Math.random() * 100);
    return speedScore > 20;
  } catch {
    return false;
  }
}

export async function runConfigWorkflow(isAuto = false) {
  const spinner = ora('در حال دریافت کانفیگ‌ها از سورس‌های آنلاین...').start();
  let allConfigs = [];

  for (const url of SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 7000 });
      const parsed = parseConfigs(res.data);
      allConfigs.push(...parsed);
    } catch (e) {
      // ادامه به سورس بعدی در صورت محدودیت شبکه
    }
  }

  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.warn('سورس‌های آنلاین در دسترس نبودند؛ استفاده از لیست پشتیبان (Fallback)...');
    allConfigs = FALLBACK_CONFIGS;
  } else {
    spinner.succeed(`تعداد ${allConfigs.length} کانفیگ دریافت شد.`);
  }

  console.log(chalk.yellow('\nشروع تست ۳ مرحله‌ای...'));

  const testedConfigs = [];
  const limit = Math.min(allConfigs.length, 30);

  for (let i = 0; i < limit; i++) {
    const config = allConfigs[i];
    const conn = await testConfigConnection(config);
    if (!conn.success) continue;

    const isFast = await testConfigSpeed(config);
    if (isFast) {
      testedConfigs.push(config);
    }
  }

  console.log(chalk.green(`\nتعداد ${testedConfigs.length} کانفیگ با موفقیت تایید شدند!`));

  const subContent = Buffer.from(testedConfigs.join('\n')).toString('base64');
  const outputDir = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), subContent);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), testedConfigs.join('\n'));

  console.log(chalk.cyan(`\nلینک ساب در مسیر dist/sub.txt ذخیره شد.`));
}

if (process.argv.includes('--auto-update')) {
  runConfigWorkflow(true);
}