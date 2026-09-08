export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Webhook endpoint
    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }

    // Set webhook on GET /setup
    if (url.pathname === '/setup') {
      return setupWebhook(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', bot: env.BOT_USERNAME });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

// ─── Webhook Handler ───

async function handleWebhook(request, env) {
  try {
    const update = await request.json();

    if (update.message) {
      await handleMessage(update.message, env);
    }

    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, env);
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ─── Message Router ───

async function handleMessage(msg, env) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const user = msg.from;

  console.log(`[${user?.username || chatId}] ${text}`);

  const [cmd, ...args] = text.split(/\s+/);
  const arg = (args[0] || '').toUpperCase();

  switch (cmd.toLowerCase()) {
    case '/start':
      return sendMsg(chatId, WELCOME_MSG, env, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📊 آمار', callback_data: 'cmd_status' }, { text: '🏥 سلامت', callback_data: 'cmd_health' }],
            [{ text: '📋 لیست', callback_data: 'cmd_list' }, { text: '🌍 کشورها', callback_data: 'cmd_countries' }],
            [{ text: '📡 سابسکریپشن', url: 'https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt' }],
          ],
        },
      });

    case '/status': {
      const data = await fetchResults(env);
      return sendMsg(chatId, formatResults(data), env);
    }

    case '/health': {
      const health = await fetchHealth(env);
      return sendMsg(chatId, formatHealth(health), env);
    }

    case '/list': {
      const data = await fetchResults(env);
      if (arg && arg.length === 2 && /^[A-Z]{2}$/.test(arg)) {
        return sendMsg(chatId, formatConfigList(data, null, arg), env);
      } else if (arg) {
        return sendMsg(chatId, formatConfigList(data, arg.toLowerCase()), env);
      }
      return sendMsg(chatId, formatConfigList(data), env);
    }

    case '/countries': {
      const health = await fetchHealth(env);
      return sendMsg(chatId, formatCountries(health), env);
    }

    case '/subscribe':
      return sendMsg(chatId, SUB_MSG, env);

    case '/dashboard':
      return sendMsg(chatId, `📊 <b>داشبورد آنلاین:</b>\n\n<a href="${DASHBOARD_URL}">${DASHBOARD_URL}</a>`, env);

    case '/api':
      return sendMsg(chatId, API_MSG, env);

    case '/send': {
      const data = await fetchResults(env);
      if (!data || !data.configs) return sendMsg(chatId, '❌ داده‌ای موجود نیست.', env);
      const configs = data.configs.filter(c => c.alive).slice(0, 5);
      if (configs.length === 0) return sendMsg(chatId, '❌ کانفیگ فعالی موجود نیست.', env);
      const lines = ['⚡ <b>بهترین کانفیگ‌ها:</b>', ''];
      for (let i = 0; i < configs.length; i++) {
        const c = configs[i];
        lines.push(`${i + 1}. ${flag(c.country)} <code>${c.host}:${c.port}</code> | ${c.protocol?.toUpperCase()} | ${c.latency || '-'}ms`);
      }
      lines.push('', `🔗 <code>${SUB_LINK}</code>`, '', '⚠️ قبل از وصل شدن آپدیت کنید!');
      return sendMsg(chatId, lines.join('\n'), env);
    }

    case '/update':
      return sendMsg(chatId, `🔄 <b>قبل از وصل شدن آپدیت کنید!</b>

1️⃣ سابسکریپشن: <code>${SUB_LINK}</code>
2️⃣ V2RayNG → Subscription → Update
3️⃣ سرور انتخاب کنید
4️⃣ وصل شوید!`, env);

    case '/crowd':
      return sendMsg(chatId, '📊 گزارش تست جمعی: هنوز داده‌ای ثبت نشده.\n\n💡 با /test گزارش بدید!', env);

    case '/help':
      return sendMsg(chatId, HELP_MSG, env);

    default:
      return sendMsg(chatId, `❓ دستور نامعتبر.\nبرای راهنما /help بزنید.`, env);
  }
}

// ─── Callback Query Handler ───

async function handleCallbackQuery(cb, env) {
  const chatId = cb.message?.chat?.id;
  const data = cb.data;

  if (!chatId || !data) return;

  await answerCallback(cb.id, env);

  switch (data) {
    case 'cmd_status': {
      const r = await fetchResults(env);
      return sendMsg(chatId, formatResults(r), env);
    }
    case 'cmd_health': {
      const h = await fetchHealth(env);
      return sendMsg(chatId, formatHealth(h), env);
    }
    case 'cmd_list': {
      const r = await fetchResults(env);
      return sendMsg(chatId, formatConfigList(r), env);
    }
    case 'cmd_countries': {
      const h = await fetchHealth(env);
      return sendMsg(chatId, formatCountries(h), env);
    }
  }
}

// ─── GitHub Data Fetchers ───

async function fetchResults(env) {
  try {
    const url = `https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/dist/results.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MRCODAD-Bot/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchHealth(env) {
  try {
    const url = `https://raw.githubusercontent.com/${env.GITHUB_REPO}/main/dist/health.json`;
    const res = await fetch(url, { headers: { 'User-Agent': 'MRCODAD-Bot/1.0' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Formatters ───

function formatResults(data) {
  if (!data) return '❌ داده‌ای موجود نیست.';
  const s = data.summary || {};
  const lines = [
    '📊 <b>آمار کلی سابسکریپشن</b>',
    '',
    `📦 کل: <b>${fmt(s.totalFetched)}</b>`,
    `🔍 یکتا: <b>${fmt(s.totalUnique)}</b>`,
    `🧪 تست شده: <b>${fmt(s.tested)}</b>`,
    `✅ زنده: <b>${fmt(s.alive)}</b>`,
    `🔒 TLS: <b>${fmt(s.tlsOk)}</b>`,
    `⭐ نهایی: <b>${fmt(s.passedFilter)}</b>`,
  ];

  if (data.byProtocol) {
    lines.push('', '🔌 <b>پروتکل‌ها:</b>');
    for (const [p, c] of Object.entries(data.byProtocol)) {
      lines.push(`  ${p.toUpperCase()}: ${c}`);
    }
  }

  if (data.health) {
    lines.push('', '🏥 <b>سلامت سرورها:</b>');
    lines.push(`  💚 سالم: ${data.health.healthyServers} | ⚠️ ناپایدار: ${data.health.unstableServers} | ❌ مرده: ${data.health.deadServers}`);
    lines.push(`  📈 آپتایم ۲۴ ساعته: ${data.health.avgUptime24h}%`);
  }

  if (data.byCountry) {
    lines.push('', '🌍 <b>کشورها:</b>');
    const sorted = Object.entries(data.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8);
    for (const [code, count] of sorted) {
      lines.push(`  ${flag(code)} ${code}: ${count}`);
    }
  }

  lines.push('', `🕐 ${data.timestamp || '-'}`);
  return lines.join('\n');
}

function formatHealth(health) {
  if (!health || !health.servers) return '❌ داده سلامت موجود نیست.';

  const servers = Object.values(health.servers);
  let healthy = 0, unstable = 0, dead = 0;

  for (const s of servers) {
    const hist = s.history || [];
    const recent = hist.slice(-96);
    if (recent.length === 0) { dead++; continue; }
    const alive = recent.filter(h => h.alive).length;
    const pct = (alive / recent.length) * 100;
    if (pct >= 80) healthy++;
    else if (pct >= 30) unstable++;
    else dead++;
  }

  const lines = [
    '🏥 <b>آمار سلامت سرورها</b>',
    '',
    `🖥 کل: <b>${servers.length}</b>`,
    `💚 سالم (>80%): <b>${healthy}</b>`,
    `⚠️ ناپایدار: <b>${unstable}</b>`,
    `❌ مرده (<30%): <b>${dead}</b>`,
    `🕐 آخرین بروزرسانی: ${health.lastUpdate || '-'}`,
  ];

  return lines.join('\n');
}

function formatConfigList(data, protocol = null, country = null) {
  if (!data || !data.configs) return '❌ داده‌ای موجود نیست.';

  let configs = data.configs.filter(c => c.alive);
  if (protocol) configs = configs.filter(c => c.protocol === protocol);
  if (country) configs = configs.filter(c => c.country?.toUpperCase() === country);

  if (configs.length === 0) return '❌ کانفیگی با این فیلتر پیدا نشد.';

  const lines = [`📋 <b>کانفیگ‌ها</b> (${configs.length})`, ''];
  for (const c of configs.slice(0, 15)) {
    const f = flag(c.country);
    const lat = c.latency ? `${c.latency}ms` : '-';
    lines.push(`✅ ${f} <code>${c.host}:${c.port}</code> | ${c.protocol?.toUpperCase()} | ${lat}`);
  }
  if (configs.length > 15) lines.push(`\n... و ${configs.length - 15} کانفیگ دیگر`);

  return lines.join('\n');
}

function formatCountries(health) {
  if (!health || !health.servers) return '❌ داده‌ای موجود نیست.';

  const counts = {};
  for (const s of Object.values(health.servers)) {
    const c = s.country || 'Unknown';
    counts[c] = (counts[c] || 0) + 1;
  }

  const lines = ['🌍 <b>کشورها:</b>', ''];
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [code, count] of sorted) {
    lines.push(`${flag(code)} <b>${code}</b>: ${count} سرور`);
  }

  return lines.join('\n');
}

// ─── Telegram API ───

async function sendMsg(chatId, text, env, options = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    }),
  }).catch(() => {});
}

async function answerCallback(callbackQueryId, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch(() => {});
}

async function setupWebhook(request, env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return jsonResponse({ error: 'No token' }, 500);

  const reqUrl = new URL(request.url);
  const workerUrl = `${reqUrl.protocol}//${reqUrl.host}`;
  const webhookUrl = `${workerUrl}/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
  });

  const result = await res.json();
  return jsonResponse(result);
}

// ─── Helpers ───

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

function flag(code) {
  if (!code || code.length !== 2) return '🌐';
  const c = code.toUpperCase();
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}

function fmt(n) {
  return (n || 0).toLocaleString();
}

// ─── Messages ───

const SUB_LINK = 'https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/sub.txt';
const DASHBOARD_URL = 'https://mrcodad.github.io/dev-vibe-cli/';
const API_URL = 'https://raw.githubusercontent.com/MRcodad/dev-vibe-cli/main/dist/api/configs.json';

const WELCOME_MSG = `👋 <b>به ربات MRCODAD خوش آمدید!</b>

📌 <b>دستورات:</b>
/status — آمار کلی
/health — سلامت سرورها
/list — لیست کانفیگ‌ها
/list DE — فیلتر کشور
/countries — لیست کشورها
/subscribe — لینک سابسکریپشن
/dashboard — داشبورد آنلاین

🔗 <b>لینک‌ها:</b>
📡 <a href="${SUB_LINK}">سابسکریپشن</a>
📊 <a href="${DASHBOARD_URL}">داشبورد</a>`;

const SUB_MSG = `📡 <b>لینک سابسکریپشن:</b>

<code>${SUB_LINK}</code>

📌 این لینک را در V2RayNG یا Sing-box وارد کنید.`;

const API_MSG = `🔗 <b>API:</b>

<code>${API_URL}</code>

همه کانفیگ‌ها: <code>configs.json</code>
فقط VLESS: <code>vless.json</code>`;

const HELP_MSG = `📖 <b>راهنما:</b>

/start — خوش‌آمدگویی
/status — آمار کلی
/health — سلامت سرورها
/list — لیست کانفیگ‌ها
/list vless — فقط VLESS
/list DE — فقط آلمان
/countries — کشورها
/subscribe — لینک سابسکریپشن
/dashboard — داشبورد
/api — لینک API
/help — این پیام`;
