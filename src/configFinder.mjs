import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

// سورس‌های بسیار باکیفیت که کانفیگ‌های تست‌شده و زنده ایران را لحظه‌ای آپدیت می‌کنند
const HIGH_QUALITY_SOURCES = [
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/reality/mix',
  'https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/vless/mix',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub1.txt',
  'https://raw.githubusercontent.com/barry-far/V2ray-Configs/main/Sub2.txt',
  'https://raw.githubusercontent.com/MahdiKhody/v2ray-collector/main/sub/mix',
  'https://raw.githubusercontent.com/soroushmirzaei/telegram-v2ray-configs/main/sub/vmess',
  'https://raw.githubusercontent.com/soroushmirzaei/telegram-v2ray-configs/main/sub/vless',
  'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/Sub26.txt',
  'https://raw.githubusercontent.com/MatinGhanbari/v2ray-configs/main/subscriptions/v2ray/super-sub.txt'
];

// تغییر نام دقیق و سالم بدون خراب کردن پارامترهای فنی کانفیگ
function renameConfig(config, index) {
  const customName = `⚡ MRCODAD | #${index + 1}`;
  
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '').trim();
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

// پارس کردن محتوا (چه Base64 باشد چه متن معمولی)
function parseConfigs(rawData) {
  let text = rawData;
  if (!text.includes('vless://') && !text.includes('vmess://') && !text.includes('trojan://') && !text.includes('ss://')) {
    try {
      text = Buffer.from(rawData.trim(), 'base64').toString('utf-8');
    } catch {
      // استفاده از متن اصلی در صورت عدم امکان دکود
    }
  }
  const lines = text.split(/\r?\n/);
  const validProtocols = ['vless://', 'vmess://', 'trojan://', 'ss://'];
  return lines.map(l => l.trim()).filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال دریافت سالم‌ترین کانفیگ‌ها از سورس‌های اختصاصی REALITY و VLESS...').start();
  let allConfigs = [];

  for (const url of HIGH_QUALITY_SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      const parsed = parseConfigs(res.data);
      allConfigs.push(...parsed);
    } catch (e) {
      // ادامه با سورس بعدی
    }
  }

  // حذف کانفیگ‌های تکراری
  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی یافت نشد.');
    return;
  }

  spinner.succeed(`مجموعاً ${allConfigs.length} کانفیگ باکیفیت استخراج شد.`);
  console.log(chalk.yellow('\nدر حال فیلتر، جداسازی پروتکل‌های جدید (Reality/VLESS) و اعمال برند MRCODAD...'));

  // اولویت‌دهی به پروتکل‌های با کیفیت بالا در ایران (VLESS و REALITY در صدر قرار می‌گیرند)
  const vlessConfigs = allConfigs.filter(c => c.startsWith('vless://'));
  const trojanConfigs = allConfigs.filter(c => c.startsWith('trojan://'));
  const vmessConfigs = allConfigs.filter(c => c.startsWith('vmess://'));
  const ssConfigs = allConfigs.filter(c => c.startsWith('ss://'));

  // ترکیب با اولویت جدیدترین پروتکل‌های فیلترشکن
  const sortedConfigs = [...vlessConfigs, ...trojanConfigs, ...vmessConfigs, ...ssConfigs];

  // انتخاب بهترین کانفیگ‌ها (تا حداکثر ۲۵۰ عدد عالی)
  const finalConfigs = [];
  const targetCount = Math.min(sortedConfigs.length, 250);

  for (let i = 0; i < targetCount; i++) {
    const renamed = renameConfig(sortedConfigs[i], finalConfigs.length);
    finalConfigs.push(renamed);
  }

  console.log(chalk.green(`\nتعداد ${finalConfigs.length} کانفیگ باکیفیت عالی با نام MRCODAD آماده گردید.`));

  // ذخیره خروجی به‌صورت Base64 و Plain
  const plainTextConfigs = finalConfigs.join('\n');
  const base64Sub = Buffer.from(plainTextConfigs).toString('base64');

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainTextConfigs);

  console.log(chalk.cyan(`\nفایل‌های سابسکریپشن با موفقیت در پوشه dist به‌روزرسانی شدند.`));
}