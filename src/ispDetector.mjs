// Iranian ISP detection and recommendations

const IRAN_ISPS = {
  'AS44244': { name: 'همراه اول', type: 'mobile', filterLevel: 'high', preferredPorts: [443, 8443, 2083], preferredSecurity: ['reality', 'tls'] },
  'AS48159': { name: 'ایرانسل', type: 'mobile', filterLevel: 'high', preferredPorts: [443, 8443], preferredSecurity: ['reality'] },
  'AS57381': { name: 'رایتل', type: 'mobile', filterLevel: 'medium', preferredPorts: [443, 8080], preferredSecurity: ['reality', 'tls'] },
  'AS12880': { name: 'مخابرات ایران', type: 'dsl', filterLevel: 'very_high', preferredPorts: [443, 8443, 2053], preferredSecurity: ['reality'] },
  'AS50810': { name: 'شاتل', type: 'dsl', filterLevel: 'medium', preferredPorts: [443, 8443], preferredSecurity: ['reality', 'tls'] },
  'AS49100': { name: 'آسیاتک', type: 'dsl', filterLevel: 'medium', preferredPorts: [443, 8443], preferredSecurity: ['reality', 'tls'] },
  'AS60631': { name: 'پارس آنلاین', type: 'dsl', filterLevel: 'medium', preferredPorts: [443, 8443], preferredSecurity: ['reality', 'tls'] },
  'AS43754': { name: 'هزارستان', type: 'dsl', filterLevel: 'low', preferredPorts: [443, 8443], preferredSecurity: ['reality', 'tls'] },
  'AS31549': { name: 'متا داده', type: 'hosting', filterLevel: 'low', preferredPorts: [443, 8443], preferredSecurity: ['reality', 'tls'] },
};

const FILTER_LEVELS = {
  very_high: { label: 'خیلی شدید', color: '#ef4444', description: 'فیلترینگ سنگین - فقط REALITY کار می‌کنه' },
  high: { label: 'شدید', color: '#f97316', description: 'فیلترینگ قوی - REALITY + TLS توصیه می‌شه' },
  medium: { label: 'متوسط', color: '#f59e0b', description: 'فیلترینگ معمولی - TLS کافیه' },
  low: { label: 'سبک', color: '#22c55e', description: 'فیلترینگ کم - اکثر کانفیگ‌ها کار می‌کنن' },
};

export function detectISP(asn, ip) {
  const isp = IRAN_ISPS[asn];
  if (isp) {
    return {
      detected: true,
      asn,
      ...isp,
      filterInfo: FILTER_LEVELS[isp.filterLevel],
    };
  }

  // Try to detect from IP range (simplified)
  if (ip) {
    const ipParts = ip.split('.').map(Number);
    if (ipParts[0] === 5 || ipParts[0] === 37) return { detected: false, guess: 'مخابرات' };
    if (ipParts[0] === 80 || ipParts[0] === 81) return { detected: false, guess: 'همراه اول' };
    if (ipParts[0] === 91 || ipParts[0] === 92) return { detected: false, guess: 'ایرانسل' };
  }

  return { detected: false, asn: null, name: 'نامشخص', filterLevel: 'medium', filterInfo: FILTER_LEVELS.medium };
}

export function getRecommendations(isp, configs) {
  if (!isp || !configs) return [];

  const preferredPorts = isp.preferredPorts || [443, 8443];
  const preferredSecurity = isp.preferredSecurity || ['reality', 'tls'];

  const scored = configs.map(cfg => {
    let score = 0;

    // Port preference
    if (preferredPorts.includes(cfg.port)) score += 30;

    // Security preference
    if (preferredSecurity.includes(cfg.security || cfg.protocol)) score += 40;
    if (cfg.security === 'reality') score += 20;

    // Latency
    if (cfg.latency) {
      if (cfg.latency < 100) score += 15;
      else if (cfg.latency < 200) score += 10;
      else if (cfg.latency < 500) score += 5;
    }

    // Crowd test reliability
    if (cfg.reliability) {
      score += Math.round(cfg.reliability / 5);
    }

    return { ...cfg, ispScore: score };
  });

  scored.sort((a, b) => b.ispScore - a.ispScore);
  return scored.slice(0, 10);
}

export function getISPAdvice(isp) {
  if (!isp || !isp.detected) {
    return '🔍 ISP شما شناسایی نشد. برای بهترین نتیجه:';
  }

  const lines = [`🔍 <b>تشخیص ISP: ${isp.name}</b>`, ''];

  lines.push(`📊 سطح فیلترینگ: <span style="color:${isp.filterInfo.color}"><b>${isp.filterInfo.label}</b></span>`);
  lines.push(`💬 ${isp.filterInfo.description}`);
  lines.push('');

  lines.push('🎯 <b>توصیه‌ها:</b>');
  lines.push(`  ✅ امنیت پیشنهادی: ${isp.preferredSecurity.map(s => s.toUpperCase()).join(' + ')}`);
  lines.push(`  🔌 پورت‌های پیشنهادی: ${isp.preferredPorts.join(', ')}`);

  if (isp.filterLevel === 'very_high') {
    lines.push('');
    lines.push('⚠️ <b>نکته مهم:</b>');
    lines.push('  فیلترینگ خیلی شدیده. فقط VLESS+REALITY کار می‌کنه.');
    lines.push('  از سرورهایی با SNI معتبر (مثل cloudflare.com) استفاده کنید.');
  }

  return lines.join('\n');
}

export { IRAN_ISPS, FILTER_LEVELS };
