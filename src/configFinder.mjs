import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ora from 'ora';
import chalk from 'chalk';

const FRESH_SOURCES = [
  'https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge.txt',
  'https://raw.githubusercontent.com/MhdiTaheri/V2rayCollector_Py/main/sub/Mix/mix.txt'
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
  return lines
    .map(l => l.trim())
    .filter(line => validProtocols.some(proto => line.startsWith(proto)));
}

function getUniqueKey(config) {
  try {
    const clean = config.split('#')[0];
    const match = clean.match(/@([^:]+):(\d+)/);
    if (match) return `${match[1]}:${match[2]}`;
  } catch {}
  return config;
}

function safeRenameConfig(config, index) {
  const safeName = `Node-${String(index + 1).padStart(3, '0')}`;
  try {
    if (config.startsWith('vmess://')) {
      const base64Str = config.replace('vmess://', '').trim();
      const decoded = Buffer.from(base64Str, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      parsed.ps = safeName;
      const reEncoded = Buffer.from(JSON.stringify(parsed), 'utf-8').toString('base64');
      return `vmess://${reEncoded}`;
    } else {
      const hashIndex = config.indexOf('#');
      const baseUrl = hashIndex !== -1 ? config.substring(0, hashIndex) : config;
      return `${baseUrl}#${safeName}`;
    }
  } catch {
    return null;
  }
}

export async function runConfigWorkflow() {
  const spinner = ora('در حال استخراج و استانداردسازی کانفیگ‌ها...').start();
  let rawConfigs = [];

  for (const url of FRESH_SOURCES) {
    try {
      const res = await axios.get(url, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      
      if (res.status === 200 && res.data) {
        const parsed = parseConfigs(res.data);
        if (parsed.length > 0) rawConfigs.push(...parsed);
      }
    } catch (e) {
      continue;
    }
  }

  if (rawConfigs.length === 0) {
    spinner.fail('هیچ کانفیگی دریافت نشد!');
    return;
  }

  const vlessConfigs = rawConfigs.filter(c => c.startsWith('vless://'));
  const otherConfigs = rawConfigs.filter(c => !c.startsWith('vless://'));
  const sorted = [...vlessConfigs, ...otherConfigs];

  const uniqueConfigs = [];
  const seenKeys = new Set();

  for (const cfg of sorted) {
    const key = getUniqueKey(cfg);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueConfigs.push(cfg);
    }
  }

  const cleanedConfigs = [];
  let count = 0;
  for (const cfg of uniqueConfigs) {
    if (count >= 300) break;
    const cleaned = safeRenameConfig(cfg, count);
    if (cleaned) {
      cleanedConfigs.push(cleaned);
      count++;
    }
  }

  spinner.succeed(`مجموعاً ${cleanedConfigs.length} کانفیگ کاملاً سالم آماده گردید.`);

  const dummyInfoServer = `vless://00000000-0000-0000-0000-000000000000@127.0.0.1:8080?type=tcp&security=none#00-UPDATE-SUB-LINK`;
  const finalConfigs = [dummyInfoServer, ...cleanedConfigs];

  const plainText = finalConfigs.join('\n').trim();
  const base64Sub = Buffer.from(plainText, 'utf-8').toString('base64').trim();

  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(distDir, 'sub.txt'), base64Sub, 'utf-8');
  fs.writeFileSync(path.join(process.cwd(), 'sub.txt'), base64Sub, 'utf-8');

  console.log(chalk.green(`\n✅ ساب‌لینک جدید با ${finalConfigs.length} کانفیگ استاندارد ساخته شد.`));
}