import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getCountryFlag, getCountryName } from './country.mjs';
import { getHealthSummary, getHealthStats } from './health.mjs';

const BASE_URL = 'https://api.telegram.org/bot';
const SUB_LINK = 'https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt';
const DASHBOARD_LINK = 'https://mrcodad.github.io/dev-vibe-cli/';
const API_LINK = 'https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/api/configs.json';

let offset = 0;
let botToken = '';

function getApi(method) {
  return `${BASE_URL}${botToken}/${method}`;
}

async function sendMessage(chatId, text, options = {}) {
  try {
    await axios.post(getApi('sendMessage'), {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    });
  } catch (err) {
    console.error(`[Bot] Send failed:`, err.response?.data?.description || err.message);
  }
}

async function sendPhoto(chatId, photoUrl, caption, options = {}) {
  try {
    await axios.post(getApi('sendPhoto'), {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      ...options,
    });
  } catch (err) {
    console.error(`[Bot] SendPhoto failed:`, err.response?.data?.description || err.message);
  }
}

function loadResults() {
  try {
    const filePath = path.join(process.cwd(), 'dist', 'results.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {}
  return null;
}

function loadHealth() {
  try {
    const filePath = path.join(process.cwd(), 'dist', 'health.json');
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {}
  return { servers: {} };
}

function getResultsText() {
  const data = loadResults();
  if (!data) return '❌ داده‌ای موجود نیست.';

  const s = data.summary;
  const lines = [
    '📊 <b>آمار کلی سابسکریپشن</b>',
    '',
    `📦 کل کانفیگ‌ها: <b>${s.totalFetched?.toLocaleString() || 0}</b>`,
    `🔍 یکتا: <b>${s.totalUnique?.toLocaleString() || 0}</b>`,
    `🧪 تست شده: <b>${s.tested || 0}</b>`,
    `✅ زنده: <b>${s.alive || 0}</b>`,
    `🔒 TLS موفق: <b>${s.tlsOk || 0}</b>`,
    `⭐ نهایی: <b>${s.passedFilter || 0}</b>`,
    '',
  ];

  if (data.byProtocol) {
    lines.push('🔌 <b>پروتکل‌ها:</b>');
    for (const [proto, count] of Object.entries(data.byProtocol)) {
      lines.push(`  ${proto.toUpperCase()}: ${count}`);
    }
    lines.push('');
  }

  if (data.byCountry) {
    lines.push('🌍 <b>کشورها:</b>');
    const sorted = Object.entries(data.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10);
    for (const [code, count] of sorted) {
      const flag = getCountryFlag(code);
      lines.push(`  ${flag} ${getCountryName(code)}: ${count}`);
    }
    lines.push('');
  }

  lines.push(`🕐 آخرین بروزرسانی: ${data.timestamp || '-'}`);
  return lines.join('\n');
}

function getHealthText() {
  const health = loadHealth();
  const stats = getHealthStats(health);

  const lines = [
    '🏥 <b>آمار سلامت سرورها</b>',
    '',
    `🖥 کل سرورها: <b>${stats.totalServers}</b>`,
    `✅ سالم (>80%): <b>${stats.healthyServers}</b>`,
    `⚠️ ناپایدار (30-80%): <b>${stats.unstableServers}</b>`,
    `❌ مرده (<30%): <b>${stats.deadServers}</b>`,
    '',
    `📈 آپتایم میانگین:`,
    `  ۲۴ ساعت: <b>${stats.avgUptime24h}%</b>`,
    `  ۷ روز: <b>${stats.avgUptime7d}%</b>`,
  ];

  if (stats.bestServers.length > 0) {
    lines.push('', '🏆 <b>بهترین سرورها:</b>');
    for (const s of stats.bestServers.slice(0, 5)) {
      const flag = getCountryFlag(s.country);
      lines.push(`  ${flag} <code>${s.host}:${s.port}</code> — ${s.uptime24h}% (${s.avgLatency}ms)`);
    }
  }

  if (stats.worstServers.length > 0) {
    lines.push('', '⚠️ <b>ضعیف‌ترین سرورها:</b>');
    for (const s of stats.worstServers.slice(0, 3)) {
      const flag = getCountryFlag(s.country);
      lines.push(`  ${flag} <code>${s.host}:${s.port}</code> — ${s.uptime24h}%`);
    }
  }

  return lines.join('\n');
}

function getCountryList() {
  const health = loadHealth();
  const countryCounts = {};

  for (const server of Object.values(health.servers)) {
    const c = server.country || 'Unknown';
    if (!countryCounts[c]) countryCounts[c] = 0;
    countryCounts[c]++;
  }

  const lines = ['🌍 <b>کشورهای موجود:</b>', ''];
  const sorted = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sorted) {
    const flag = getCountryFlag(code);
    lines.push(`${flag} <b>${getCountryName(code)}</b> (${code}): ${count} سرور`);
  }
  return lines.join('\n');
}

function getConfigList(protocol = null, country = null) {
  const data = loadResults();
  if (!data || !data.configs) return '❌ داده‌ای موجود نیست.';

  let configs = data.configs.filter(c => c.alive);

  if (protocol) {
    configs = configs.filter(c => c.protocol === protocol.toLowerCase());
  }
  if (country) {
    configs = configs.filter(c => c.country?.toUpperCase() === country.toUpperCase());
  }

  if (configs.length === 0) return '❌ کانفیگی با این فیلتر پیدا نشد.';

  const lines = [`📋 <b>کانفیگ‌ها</b> (${configs.length} مورد)`, ''];
  for (const c of configs.slice(0, 20)) {
    const flag = getCountryFlag(c.country);
    const status = c.alive ? '✅' : '❌';
    const latency = c.latency ? `${c.latency}ms` : '-';
    lines.push(`${status} ${flag} <code>${c.host}:${c.port}</code> | ${c.protocol?.toUpperCase()} | ${latency}`);
  }
  if (configs.length > 20) {
    lines.push('', `... و ${configs.length - 20} کانفیگ دیگر`);
  }
  return lines.join('\n');
}

const WELCOME_MSG = [
  '👋 <b>به ربات MRCODAD خوش آمدید!</b>',
  '',
  'این ربات سابسکریپشن V2Ray را مدیریت می‌کند.',
  '',
  '📌 <b>دستورات:</b>',
  '',
  '/status — آمار کلی سابسکریپشن',
  '/health — آمار سلامت سرورها',
  '/list — لیست کانفیگ‌های فعال',
  '/list vless — فیلتر بر اساس پروتکل',
  '/list DE — فیلتر بر اساس کشور',
  '/countries — لیست کشورها',
  '/subscribe — لینک سابسکریپشن',
  '/dashboard — لینک داشبورد',
  '/api — لینک API',
  '/help — راهنما',
  '',
  '🔗 <b>لینک‌های سریع:</b>',
  `📡 سابسکریپشن: <a href="${SUB_LINK}">دانلود</a>`,
  `📊 داشبورد: <a href="${DASHBOARD_LINK}">مشاهده</a>`,
].join('\n');

const HELP_MSG = [
  '📖 <b>راهنمای ربات</b>',
  '',
  '🔹 /start — پیام خوش‌آمدگویی',
  '🔹 /status — نمایش آمار کلی (تعداد سرورها، پروتکل‌ها، کشورها)',
  '🔹 /health — نمایش آمار سلامت و آپتایم سرورها',
  '🔹 /list — نمایش لیست کانفیگ‌های فعال',
  '🔹 /list vless — فقط کانفیگ‌های VLESS',
  '🔹 /list vmess — فقط کانفیگ‌های VMess',
  '🔹 /list DE — فقط سرورهای آلمان',
  '🔹 /list US — فقط سرورهای آمریکا',
  '🔹 /countries — لیست تمام کشورها با تعداد سرور',
  '🔹 /subscribe — لینک سابسکریپشن Base64',
  '🔹 /dashboard — لینک داشبورد آنلاین',
  '🔹 /api — لینک API',
  '🔹 /help — این پیام',
  '',
  '💡 نکته: اطلاعات هر ۱۵ دقیقه بروزرسانی می‌شود.',
].join('\n');

async function handleCommand(chatId, text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts[1]?.toUpperCase();

  switch (cmd) {
    case '/start':
      await sendMessage(chatId, WELCOME_MSG, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 آمار', callback_data: 'cmd_status' }, { text: '🏥 سلامت', callback_data: 'cmd_health' }],
            [{ text: '📋 لیست کانفیگ', callback_data: 'cmd_list' }, { text: '🌍 کشورها', callback_data: 'cmd_countries' }],
            [{ text: '📡 سابسکریپشن', url: SUB_LINK }, { text: '📊 داشبورد', url: DASHBOARD_LINK }],
          ],
        },
      });
      break;

    case '/status':
      await sendMessage(chatId, getResultsText());
      break;

    case '/health':
      await sendMessage(chatId, getHealthText());
      break;

    case '/list':
      if (arg && arg.length === 2 && /^[A-Z]{2}$/.test(arg)) {
        await sendMessage(chatId, getConfigList(null, arg));
      } else if (arg) {
        await sendMessage(chatId, getConfigList(arg.toLowerCase()));
      } else {
        await sendMessage(chatId, getConfigList());
      }
      break;

    case '/countries':
      await sendMessage(chatId, getCountryList());
      break;

    case '/subscribe':
      await sendMessage(chatId, `📡 <b>لینک سابسکریپشن:</b>\n\n<code>${SUB_LINK}</code>\n\n📌 این لینک را در V2RayNG یا Sing-box وارد کنید.`);
      break;

    case '/dashboard':
      await sendMessage(chatId, `📊 <b>داشبورد آنلاین:</b>\n\n<a href="${DASHBOARD_LINK}">${DASHBOARD_LINK}</a>`);
      break;

    case '/api':
      await sendMessage(chatId, `🔗 <b>API:</b>\n\n<code>${API_LINK}</code>\n\nهمه کانفیگ‌ها: <code>configs.json</code>\nفقط VLESS: <code>vless.json</code>`);
      break;

    case '/help':
      await sendMessage(chatId, HELP_MSG);
      break;

    default:
      await sendMessage(chatId, `❓ دستور نامعتبر: ${cmd}\nبرای راهنما /help را بزنید.`);
  }
}

async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message?.chat?.id;
  const data = callbackQuery.data;

  if (!chatId || !data) return;

  await axios.post(getApi('answerCallbackQuery'), {
    callback_query_id: callbackQuery.id,
  }).catch(() => {});

  switch (data) {
    case 'cmd_status':
      await sendMessage(chatId, getResultsText());
      break;
    case 'cmd_health':
      await sendMessage(chatId, getHealthText());
      break;
    case 'cmd_list':
      await sendMessage(chatId, getConfigList());
      break;
    case 'cmd_countries':
      await sendMessage(chatId, getCountryList());
      break;
  }
}

async function pollUpdates() {
  try {
    const res = await axios.get(getApi('getUpdates'), {
      params: { offset, timeout: 30 },
      timeout: 35000,
    });

    if (res.data?.ok && res.data.result) {
      for (const update of res.data.result) {
        offset = update.update_id + 1;

        if (update.message?.text) {
          const chatId = update.message.chat.id;
          const text = update.message.text;
          console.log(`[Bot] ${update.message.from?.username || chatId}: ${text}`);
          await handleCommand(chatId, text);
        }

        if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ECONNABORTED') {
      console.error('[Bot] Poll error:', err.message);
    }
  }
}

async function startBot() {
  botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('[Bot] TELEGRAM_BOT_TOKEN not set!');
    console.log('Usage: TELEGRAM_BOT_TOKEN=your_token node src/telegramBot.mjs');
    process.exit(1);
  }

  console.log('[Bot] Starting MRCODAD Telegram Bot...');
  console.log('[Bot] Press Ctrl+C to stop.');

  while (true) {
    await pollUpdates();
  }
}

startBot();
