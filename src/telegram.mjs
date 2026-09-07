import axios from 'axios';

export async function sendTelegramNotification(stats) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('[Telegram] Token or Chat ID not set, skipping notification.');
    return false;
  }

  const now = new Date().toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });

  const protocolLines = Object.entries(stats.byProtocol || {})
    .sort((a, b) => b[1] - a[1])
    .map(([proto, count]) => `  ${proto}: ${count}`)
    .join('\n');

  const countryLines = Object.entries(stats.byCountry || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => `  ${code}: ${count}`)
    .join('\n');

  const message = [
    `🔄 *آپدیت خودکار سابسکریپشن*`,
    `📅 ${now}`,
    ``,
    `📊 *آمار کلی:*`,
    `  کل کانفیگ‌ها: *${stats.totalFetched}*`,
    `  یکتا: *${stats.totalUnique}*`,
    `  تست شده: *${stats.tested}*`,
    `  ✅ زنده: *${stats.alive}*`,
    `  🔒 TLS: *${stats.tlsOk}*`,
    `  ⭐ نهایی: *${stats.passedFilter}*`,
    ``,
    `🔌 *پروتکل‌ها:*`,
    protocolLines || '  -',
    ``,
    `🌍 *کشورها (top 10):*`,
    countryLines || '  -',
    ``,
    `🔗 [مشاهده داشبورد](https://mrcodad.github.io/dev-vibe-cli/)`,
  ].join('\n');

  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }, { timeout: 10000 });

    console.log('[Telegram] Notification sent successfully.');
    return true;
  } catch (err) {
    console.error('[Telegram] Failed to send:', err.message);
    return false;
  }
}
