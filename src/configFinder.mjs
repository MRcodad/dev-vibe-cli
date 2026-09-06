import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

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

// تبدیل کد کشور به ایموجی پرچم
function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// استخراج دامنه یا آی‌پی از کانفیگ
function extractHost(config) {
  try {
    if (config.startsWith('vmess://')) {
      const json = JSON.parse(Buffer.from(config.replace('vmess://', ''), 'base64').toString('utf-8'));
      return json.add || json.sni || null;
    } else {
      const urlPart = config.split('@')[1];
      if (!urlPart) return null;
      const hostPort = urlPart.split('?')[0].split('#')[0];
      return hostPort.split(':')[0];
    }
  } catch {
    return null;
  }
}

// تغییر نام با اضافه کردن پرچم کشور و برند MRCODAD
function renameConfig(config, index, flag = '⚡') {
  const customName = `${flag} MRCODAD | #${index + 1}`;
  
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

// تولید ساده کانفیگ Clash YAML
function generateClashMetaConfig(configs) {
  return `# MRCODAD V2Ray Subscription for Clash Meta
port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
proxies:
  # Base V2Ray configs provided as raw list
  # Sub Link: https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt
proxy-groups:
  - name: ⚡ MRCODAD-AUTO
    type: select
    proxies:
      - DIRECT
`;
}

// تولید داشبورد وب زنده HTML
function generateDashboardHtml(totalCount, lastUpdate) {
  const subLink = "https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt";
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MRCODAD V2Ray Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col items-center justify-center p-4">
  <div class="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center">
    <div class="inline-block bg-red-500/10 text-red-400 p-3 rounded-full mb-4 font-bold text-2xl">⚡</div>
    <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400 mb-2">
      MRCODAD Subscription Dashboard
    </h1>
    <p class="text-slate-400 text-sm mb-6">سابسکریپشن هوشمند و خودکار V2Ray با به‌روزرسانی ۲ ساعته</p>

    <div class="grid grid-cols-2 gap-4 mb-6">
      <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
        <span class="text-xs text-slate-400 block mb-1">تعداد کانفیگ‌های زنده</span>
        <span class="text-2xl font-bold text-emerald-400">${totalCount}</span>
      </div>
      <div class="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
        <span class="text-xs text-slate-400 block mb-1">آخرین به‌روزرسانی</span>
        <span class="text-xs font-semibold text-orange-300 block mt-2">${lastUpdate}</span>
      </div>
    </div>

    <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between mb-6">
      <input type="text" id="subUrl" readonly value="${subLink}" class="bg-transparent text-xs text-slate-300 w-full outline-none px-2 text-left dir-ltr">
      <button onclick="copySub()" class="bg-red-600 hover:bg-red-500 text-white text-xs px-4 py-2 rounded-lg font-medium transition ml-2">کپی</button>
    </div>

    <div class="flex justify-center mb-4">
      <canvas id="qrcode" class="rounded-xl border border-slate-700 p-2 bg-white"></canvas>
    </div>
    <p class="text-xs text-slate-500">برای اتصال سریع، کد فوق را در V2RayNG یا MahsaNG اسکن کنید.</p>
  </div>

  <script>
    QRCode.toCanvas(document.getElementById('qrcode'), "${subLink}", { width: 160 });
    function copySub() {
      const copyText = document.getElementById("subUrl");
      navigator.clipboard.writeText(copyText.value);
      alert("لینک سابسکریپشن کپی شد!");
    }
  </script>
</body>
</html>`;
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال جمع‌آوری کانفیگ‌ها و آنالیز لوکیشن‌ها...').start();
  let allConfigs = [];

  for (const url of HIGH_QUALITY_SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      allConfigs.push(...parseConfigs(res.data));
    } catch {}
  }

  allConfigs = [...new Set(allConfigs)];

  if (allConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی یافت نشد.');
    return;
  }

  spinner.succeed(`مجموعاً ${allConfigs.length} کانفیگ استخراج شد.`);
  console.log(chalk.yellow('\nدر حال استخراج IP/SNI، تشخیص کشور و ساخت فرمت‌های متنوع...'));

  const sortedConfigs = [
    ...allConfigs.filter(c => c.startsWith('vless://')),
    ...allConfigs.filter(c => c.startsWith('trojan://')),
    ...allConfigs.filter(c => c.startsWith('vmess://')),
    ...allConfigs.filter(c => c.startsWith('ss://'))
  ];

  const finalConfigs = [];
  const targetCount = Math.min(sortedConfigs.length, 250);

  for (let i = 0; i < targetCount; i++) {
    const raw = sortedConfigs[i];
    const host = extractHost(raw);
    let flag = '⚡';

    if (host) {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${host}?fields=countryCode`, { timeout: 1200 });
        if (geoRes.data && geoRes.data.countryCode) {
          flag = getFlagEmoji(geoRes.data.countryCode);
        }
      } catch {}
    }

    finalConfigs.push(renameConfig(raw, finalConfigs.length, flag));
  }

  const plainTextConfigs = finalConfigs.join('\n');
  const base64Sub = Buffer.from(plainTextConfigs).toString('base64');
  const now = new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });

  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  // ۱. فایل‌های پایه سابسکریپشن
  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainTextConfigs);

  // ۲. داشبورد وب HTML جهت نمایش در GitHub Pages
  fs.writeFileSync(path.join(outputDir, 'index.html'), generateDashboardHtml(finalConfigs.length, now));

  // ۳. فایل کانفیگ Clash Meta
  fs.writeFileSync(path.join(outputDir, 'clash.yaml'), generateClashMetaConfig(finalConfigs));

  console.log(chalk.green(`\n✅ آپدیت بزرگ با موفقیت انجام شد!`));
  console.log(chalk.cyan(`
- لینک سابسکریپشن اصلی: dist/sub.txt
- داشبورد وب زنده: dist/index.html
- کانفیگ Clash Meta: dist/clash.yaml
  `));
}