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

function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

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

export async function runConfigWorkflow() {
  const spinner = ora('در حال استخراج و ساخت سابسکریپشن بدون ریزش...').start();
  let rawConfigs = [];

  for (const url of HIGH_QUALITY_SOURCES) {
    try {
      const res = await axios.get(url, { timeout: 8000 });
      rawConfigs.push(...parseConfigs(res.data));
    } catch {}
  }

  rawConfigs = [...new Set(rawConfigs)];
  spinner.succeed(`مجموعاً ${rawConfigs.length} کانفیگ استخراج شد.`);

  // اولویت‌بندی بر اساس بهترین پروتکل‌ها برای ایران (REALITY > VLESS > Trojan > VMess)
  const sorted = [
    ...rawConfigs.filter(c => c.includes('security=reality')),
    ...rawConfigs.filter(c => c.startsWith('vless://') && !c.includes('security=reality')),
    ...rawConfigs.filter(c => c.startsWith('trojan://')),
    ...rawConfigs.filter(c => c.startsWith('vmess://')),
    ...rawConfigs.filter(c => c.startsWith('ss://'))
  ];

  const targetCount = Math.min(sorted.length, 150);
  const finalConfigs = [];

  for (let i = 0; i < targetCount; i++) {
    const raw = sorted[i];
    const host = extractHost(raw);
    let flag = '⚡';

    if (host) {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${host}?fields=countryCode`, { timeout: 1000 });
        if (geoRes.data && geoRes.data.countryCode) {
          flag = getFlagEmoji(geoRes.data.countryCode);
        }
      } catch {}
    }
    finalConfigs.push(renameConfig(raw, finalConfigs.length, flag));
  }

  const plainText = finalConfigs.join('\n');
  const base64Sub = Buffer.from(plainText).toString('base64');
  const outputDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  fs.writeFileSync(path.join(outputDir, 'sub.txt'), base64Sub);
  fs.writeFileSync(path.join(outputDir, 'sub_plain.txt'), plainText);

  console.log(chalk.green(`\n✅ سابسکریپشن با ${finalConfigs.length} کانفیگ اولویت‌بندی‌شده ذخیره شد.`));
}