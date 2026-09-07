import fs from 'fs';
import path from 'path';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MRCODAD V2Ray Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a1a;color:#e0e0e0;min-height:100vh}
.header{background:linear-gradient(135deg,#1a1a3e 0%,#0d0d2b 50%,#1a0a2e 100%);padding:30px 20px;text-align:center;border-bottom:2px solid #2a2a5a}
.header h1{font-size:28px;margin-bottom:6px;background:linear-gradient(90deg,#00d4ff,#7c3aed,#f472b6,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header p{color:#8888aa;font-size:14px}
.nav{display:flex;justify-content:center;gap:8px;margin-top:15px;flex-wrap:wrap}
.nav-btn{background:#1a1a3e;border:1px solid #2a2a5a;color:#8888aa;padding:6px 16px;border-radius:20px;cursor:pointer;font-size:12px;transition:all .2s}
.nav-btn:hover,.nav-btn.active{background:#7c3aed;color:#fff;border-color:#7c3aed}
.container{max-width:1200px;margin:0 auto;padding:20px}
.section{display:none}.section.active{display:block}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:20px;text-align:center;border:1px solid #2a2a5a;transition:transform .2s}
.stat-card:hover{transform:translateY(-2px)}
.stat-icon{font-size:28px;margin-bottom:6px}
.stat-value{font-size:32px;font-weight:700;margin-bottom:4px}
.stat-label{color:#8888aa;font-size:11px;text-transform:uppercase;letter-spacing:1px}
.stat-card.alive .stat-value{color:#22c55e}.stat-card.tls .stat-value{color:#3b82f6}
.stat-card.filtered .stat-value{color:#a855f7}.stat-card.total .stat-value{color:#f59e0b}
.stat-card.healthy .stat-value{color:#22c55e}.stat-card.unstable .stat-value{color:#f59e0b}
.stat-card.dead .stat-value{color:#ef4444}
.health-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:16px;border:1px solid #2a2a5a}
.chart-card h3{color:#ccc;font-size:14px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2a2a5a}
.table-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:16px;border:1px solid #2a2a5a;margin-bottom:24px}
.table-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px}
.table-header h3{color:#ccc;font-size:14px}
.search-box{background:#0f0f23;border:1px solid #2a2a5a;color:#e0e0e0;padding:6px 12px;border-radius:8px;font-size:12px;width:200px;outline:none}
.search-box:focus{border-color:#7c3aed}
.badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600}
.badge-green{background:#052e16;color:#22c55e;border:1px solid #166534}
.badge-red{background:#450a0a;color:#ef4444;border:1px solid #991b1b}
.badge-blue{background:#0c1e3d;color:#60a5fa;border:1px solid #1e40af}
.badge-purple{background:#2e1065;color:#c084fc;border:1px solid #6b21a8}
.badge-gray{background:#1f2937;color:#9ca3af;border:1px solid #374151}
.badge-yellow{background:#422006;color:#fbbf24;border:1px solid #92400e}
.badge-cyan{background:#083344;color:#22d3ee;border:1px solid #155e75}
table{width:100%;border-collapse:collapse}
th{text-align:right;padding:10px 8px;color:#8888aa;font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #2a2a5a}
td{padding:8px;border-bottom:1px solid #1a1a3e;font-size:12px}
tr:hover td{background:rgba(124,58,237,0.05)}
.footer{text-align:center;padding:20px;color:#555;font-size:11px;border-top:1px solid #1a1a3e}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:4px}
.status-dot.alive{background:#22c55e;box-shadow:0 0 6px #22c55e}
.status-dot.dead{background:#ef4444;box-shadow:0 0 6px #ef4444}
.uptime-bar{width:100%;height:6px;background:#1a1a3e;border-radius:3px;overflow:hidden;margin-top:4px}
.uptime-fill{height:100%;border-radius:3px;transition:width .3s}
.uptime-high{background:linear-gradient(90deg,#22c55e,#16a34a)}
.uptime-mid{background:linear-gradient(90deg,#f59e0b,#d97706)}
.uptime-low{background:linear-gradient(90deg,#ef4444,#dc2626)}
.server-name{color:#a855f7;font-weight:600;font-size:11px}
.no-data{text-align:center;padding:40px;color:#555}
/* Map */
.map-container{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:16px;border:1px solid #2a2a5a;margin-bottom:24px;position:relative;overflow:hidden}
.map-container h3{color:#ccc;font-size:14px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2a2a5a}
.world-map{width:100%;height:400px;position:relative;background:#0a0a1a;border-radius:8px;overflow:hidden}
.map-dot{position:absolute;width:10px;height:10px;border-radius:50%;cursor:pointer;transition:transform .2s;z-index:2}
.map-dot:hover{transform:scale(1.8);z-index:10}
.map-dot.alive{background:#22c55e;box-shadow:0 0 8px #22c55e}
.map-dot.dead{background:#ef4444;box-shadow:0 0 8px #ef4444}
.map-dot:hover::after{content:attr(data-tip);position:absolute;bottom:120%;left:50%;transform:translateX(-50%);background:#1a1a3e;color:#fff;padding:4px 8px;border-radius:6px;font-size:10px;white-space:nowrap;border:1px solid #2a2a5a;z-index:100}
.map-legend{display:flex;gap:16px;margin-top:8px;font-size:11px;color:#888}
.map-legend span{display:flex;align-items:center;gap:4px}
/* Speed */
.speed-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px}
.speed-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:10px;padding:14px;border:1px solid #2a2a5a;text-align:center}
.speed-card .grade{font-size:28px;font-weight:700;margin:4px 0}
.speed-card .speed-val{font-size:14px;color:#8888aa}
.speed-card .server-info{font-size:11px;color:#666;margin-top:4px}
/* Anti-Censor */
.censor-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.censor-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:16px;border:1px solid #2a2a5a;text-align:center}
.censor-card .score{font-size:36px;font-weight:700}
.censor-card .label{color:#8888aa;font-size:11px;margin-top:4px}
.risk-bar{width:100%;height:8px;background:#1a1a3e;border-radius:4px;overflow:hidden;margin-top:8px}
.risk-fill{height:100%;border-radius:4px}
/* Gamification */
.gamification-section{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:20px;border:1px solid #2a2a5a;margin-bottom:24px}
.gamification-section h3{color:#ccc;font-size:14px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2a2a5a}
.level-badge{font-size:24px;font-weight:700;color:#fbbf24}
.medal{font-size:32px}
.leaderboard-row{display:flex;align-items:center;gap:12px;padding:8px;border-bottom:1px solid #1a1a3e}
.leaderboard-row:last-child{border-bottom:none}
.rank{font-size:18px;font-weight:700;color:#888;width:30px}
.rank-1{color:#fbbf24}.rank-2{color:#c0c0c0}.rank-3{color:#cd7f32}
.username{flex:1;font-weight:600}
.user-points{color:#a855f7;font-weight:700}
@media(max-width:768px){.stats-grid,.censor-grid{grid-template-columns:repeat(2,1fr)}.health-grid{grid-template-columns:1fr}.charts-grid{grid-template-columns:1fr}.speed-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:480px){.stats-grid{grid-template-columns:1fr}.speed-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="header">
  <h1>MRCODAD V2Ray Platform</h1>
  <p>جمع‌آوری، تست، فیلتر و محافظت هوشمند کانفیگ‌های V2Ray</p>
  <div id="refreshInfo" style="color:#666;font-size:11px;margin-top:4px"></div>
  <div class="nav">
    <button class="nav-btn active" onclick="showSection('overview')">📊 داشبورد</button>
    <button class="nav-btn" onclick="showSection('map')">🌍 نقشه</button>
    <button class="nav-btn" onclick="showSection('speed')">⚡ سرعت</button>
    <button class="nav-btn" onclick="showSection('censor')">🛡 ضد سانسور</button>
    <button class="nav-btn" onclick="showSection('game')">🏆 لیدربورد</button>
  </div>
</div>
<div class="container">
  <!-- Overview -->
  <div class="section active" id="sec-overview">
    <div class="stats-grid">
      <div class="stat-card total"><div class="stat-icon">📦</div><div class="stat-value" id="totalFetched">-</div><div class="stat-label">کل کانفیگ‌ها</div></div>
      <div class="stat-card alive"><div class="stat-icon">✅</div><div class="stat-value" id="aliveCount">-</div><div class="stat-label">سرور زنده</div></div>
      <div class="stat-card tls"><div class="stat-icon">🔒</div><div class="stat-value" id="tlsCount">-</div><div class="stat-label">TLS موفق</div></div>
      <div class="stat-card filtered"><div class="stat-icon">⭐</div><div class="stat-value" id="filteredCount">-</div><div class="stat-label">نهایی</div></div>
    </div>
    <div class="health-grid">
      <div class="stat-card healthy"><div class="stat-icon">💚</div><div class="stat-value" id="healthyCount">-</div><div class="stat-label">سالم (>80%)</div><div class="uptime-bar"><div class="uptime-fill uptime-high" id="healthyBar" style="width:0%"></div></div></div>
      <div class="stat-card unstable"><div class="stat-icon">⚠️</div><div class="stat-value" id="unstableCount">-</div><div class="stat-label">ناپایدار</div><div class="uptime-bar"><div class="uptime-fill uptime-mid" id="unstableBar" style="width:0%"></div></div></div>
      <div class="stat-card dead"><div class="stat-icon">❌</div><div class="stat-value" id="deadCount">-</div><div class="stat-label">مرده (<30%)</div><div class="uptime-bar"><div class="uptime-fill uptime-low" id="deadBar" style="width:0%"></div></div></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>🔌 پروتکل‌ها</h3><canvas id="protocolChart"></canvas></div>
      <div class="chart-card"><h3>🌍 کشورها</h3><canvas id="countryChart"></canvas></div>
      <div class="chart-card"><h3>📡 پینگ</h3><canvas id="latencyChart"></canvas></div>
      <div class="chart-card"><h3>⭐ امتیاز</h3><canvas id="scoreChart"></canvas></div>
    </div>
    <div class="table-card">
      <div class="table-header"><h3>📋 لیست سرورها (<span id="serverCount">0</span>)</h3><input type="text" class="search-box" id="searchBox" placeholder="جستجو..."></div>
      <div style="overflow-x:auto"><table><thead><tr><th>#</th><th>وضعیت</th><th>نام</th><th>پروتکل</th><th>آدرس</th><th>پورت</th><th>کشور</th><th>پینگ</th><th>امتیاز</th></tr></thead><tbody id="serverTable"></tbody></table></div>
    </div>
  </div>
  <!-- Map -->
  <div class="section" id="sec-map">
    <div class="map-container">
      <h3>🌍 نقشه زنده سرورها</h3>
      <div class="world-map" id="worldMap"></div>
      <div class="map-legend"><span><span style="width:10px;height:10px;border-radius:50%;background:#22c55e;display:inline-block"></span> فعال</span><span><span style="width:10px;height:10px;border-radius:50%;background:#ef4444;display:inline-block"></span> غیرفعال</span></div>
    </div>
    <div class="charts-grid">
      <div class="chart-card"><h3>🌍 توزیع جغرافیایی</h3><canvas id="geoChart"></canvas></div>
      <div class="chart-card"><h3>🛡 وضعیت ضد سانسور</h3><canvas id="censorMapChart"></canvas></div>
    </div>
  </div>
  <!-- Speed -->
  <div class="section" id="sec-speed">
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="stat-card" style="border-color:#22c55e"><div class="stat-icon">⚡</div><div class="stat-value" id="avgSpeed" style="color:#22c55e">-</div><div class="stat-label">میانگین سرعت</div></div>
      <div class="stat-card" style="border-color:#3b82f6"><div class="stat-icon">🏆</div><div class="stat-value" id="bestSpeed" style="color:#3b82f6">-</div><div class="stat-label">بهترین سرعت</div></div>
      <div class="stat-card" style="border-color:#a855f7"><div class="stat-icon">📊</div><div class="stat-value" id="avgLatency" style="color:#a855f7">-</div><div class="stat-label">میانگین پینگ</div></div>
    </div>
    <h3 style="color:#ccc;margin-bottom:12px">⚡ سرعت سرورها</h3>
    <div class="speed-grid" id="speedGrid"></div>
  </div>
  <!-- Anti-Censor -->
  <div class="section" id="sec-censor">
    <div class="censor-grid" id="censorStats"></div>
    <h3 style="color:#ccc;margin-bottom:12px">🛡 تحلیل ضد سانسور</h3>
    <div class="table-card">
      <div style="overflow-x:auto"><table><thead><tr><th>#</th><th>سرور</th><th>پروتکل</th><th>امنیت</th><th>پورت</th><th>وضعیت</th><th>امتیاز</th><th>ریسک</th></tr></thead><tbody id="censorTable"></tbody></table></div>
    </div>
  </div>
  <!-- Gamification -->
  <div class="section" id="sec-game">
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card" style="border-color:#fbbf24"><div class="stat-icon">🏆</div><div class="stat-value" id="totalTests" style="color:#fbbf24">-</div><div class="stat-label">کل تست‌ها</div></div>
      <div class="stat-card" style="border-color:#a855f7"><div class="stat-icon">👥</div><div class="stat-value" id="totalUsers" style="color:#a855f7">-</div><div class="stat-label">کاربران</div></div>
      <div class="stat-card" style="color:#22c55e"><div class="stat-icon">🟢</div><div class="stat-value" id="activeToday">-</div><div class="stat-label">فعال امروز</div></div>
      <div class="stat-card" style="border-color:#3b82f6"><div class="stat-icon">📡</div><div class="stat-value" id="totalServers" style="color:#3b82f6">-</div><div class="stat-label">سرورها</div></div>
    </div>
    <div class="gamification-section">
      <h3>🏆 لیدربورد</h3>
      <div id="leaderboard"></div>
    </div>
  </div>
</div>
<div class="footer">MRCODAD V2Ray Platform &mdash; بروزرسانی خودکار هر ۱۵ دقیقه</div>
<script>
const COLORS=['#7c3aed','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#06b6d4','#8b5cf6','#10b981','#f97316','#6366f1','#14b8a6'];
const FLAGS={'AF':'🇦🇫','AL':'🇦🇱','DZ':'🇩🇿','AD':'🇦🇩','AO':'🇦🇴','AG':'🇦🇬','AR':'🇦🇷','AM':'🇦🇲','AU':'🇦🇺','AT':'🇦🇹','AZ':'🇦🇿','BS':'🇧🇸','BH':'🇧🇭','BD':'🇧🇩','BB':'🇧🇧','BY':'🇧🇾','BE':'🇧🇪','BZ':'🇧🇿','BJ':'🇧🇯','BT':'🇧🇹','BO':'🇧🇴','BA':'🇧🇦','BW':'🇧🇼','BR':'🇧🇷','BN':'🇧🇳','BG':'🇧🇬','BF':'🇧🇫','BI':'🇧🇮','KH':'🇰🇭','CM':'🇨🇲','CA':'🇨🇦','CV':'🇨🇻','CF':'🇨🇫','TD':'🇹🇩','CL':'🇨🇱','CN':'🇨🇳','CO':'🇨🇴','KM':'🇰🇲','CG':'🇨🇬','CR':'🇨🇷','HR':'🇭🇷','CU':'🇨🇺','CY':'🇨🇾','CZ':'🇨🇿','DK':'🇩🇰','DJ':'🇯🇮','DM':'🇩🇲','DO':'🇩🇴','EC':'🇪🇨','EG':'🇪🇬','SV':'🇸🇻','GQ':'🇬🇶','ER':'🇪🇷','EE':'🇪🇪','ET':'🇪🇹','FJ':'🇫🇯','FI':'🇫🇮','FR':'🇫🇷','GA':'🇬🇦','GM':'🇬🇲','GE':'🇬🇪','DE':'🇩🇪','GH':'🇬🇭','GR':'🇬🇷','GD':'🇬🇩','GT':'🇬🇹','GN':'🇬🇳','GW':'🇬🇼','GY':'🇬🇾','HT':'🇭🇹','HN':'🇭🇳','HU':'🇭🇺','IS':'🇮🇸','IN':'🇮🇳','ID':'🇮🇩','IR':'🇮🇷','IQ':'🇮🇶','IE':'🇮🇪','IL':'🇮🇱','IT':'🇮🇹','JM':'🇯🇲','JP':'🇯🇵','JO':'🇯🇴','KZ':'🇰🇿','KE':'🇰🇪','KI':'🇰🇮','KP':'🇰🇵','KR':'🇰🇷','KW':'🇰🇼','KG':'🇰🇬','LA':'🇱🇦','LV':'🇱🇻','LB':'🇱🇧','LS':'🇱🇸','LR':'🇱🇷','LY':'🇱🇾','LI':'🇱🇮','LT':'🇱🇹','LU':'🇱🇺','MG':'🇲🇬','MW':'🇲🇼','MY':'🇲🇾','MV':'🇲🇻','ML':'🇲🇱','MT':'🇲🇹','MH':'🇲🇭','MR':'🇲🇷','MU':'🇲🇺','MX':'🇲🇽','FM':'🇫🇲','MD':'🇲🇩','MC':'🇲🇨','MN':'🇲🇳','ME':'🇲🇪','MA':'🇲🇦','MZ':'🇲🇿','MM':'🇲🇲','NA':'🇳🇦','NR':'🇳🇷','NP':'🇳🇵','NL':'🇳🇱','NZ':'🇳🇿','NI':'🇳🇮','NE':'🇳🇪','NG':'🇳🇬','NO':'🇳🇴','OM':'🇴🇲','PK':'🇵🇰','PW':'🇵🇼','PA':'🇵🇦','PG':'🇵🇬','PY':'🇵🇾','PE':'🇵🇪','PH':'🇵🇭','PL':'🇵🇱','PT':'🇵🇹','QA':'🇶🇦','RO':'🇷🇴','RU':'🇷🇺','RW':'🇷🇼','KN':'🇰🇳','LC':'🇱🇨','VC':'🇻🇨','WS':'🇼🇸','SM':'🇸🇲','ST':'🇸🇹','SA':'🇸🇦','SN':'🇸🇳','RS':'🇷🇸','SC':'🇸🇨','SL':'🇸🇱','SG':'🇸🇬','SK':'🇸🇰','SI':'🇸🇮','SB':'🇸🇧','SO':'🇸🇴','ZA':'🇿🇦','SS':'🇸🇸','ES':'🇪🇸','LK':'🇱🇰','SD':'🇸🇩','SR':'🇸🇷','SZ':'🇸🇿','SE':'🇸🇪','CH':'🇨🇭','SY':'🇸🇾','TW':'🇹🇼','TJ':'🇹🇯','TZ':'🇹🇿','TH':'🇹🇭','TL':'🇹🇱','TG':'🇹🇬','TO':'🇹🇴','TT':'🇹🇹','TN':'🇹🇳','TR':'🇹🇷','TM':'🇹🇲','TV':'🇹🇻','UG':'🇺🇬','UA':'🇺🇦','AE':'🇦🇪','GB':'🇬🇧','US':'🇺🇸','UY':'🇺🇾','UZ':'🇺🇿','VU':'🇻🇺','VA':'🇻🇦','VE':'🇻🇪','VN':'🇻🇳','YE':'🇾🇪','ZM':'🇿🇲','ZW':'🇿🇼'};
const GEO={US:{lat:39,lng:-98},DE:{lat:51,lng:10},NL:{lat:52,lng:5},FR:{lat:46,lng:2},GB:{lat:54,lng:-2},CA:{lat:56,lng:-106},AU:{lat:-25,lng:133},JP:{lat:36,lng:138},SG:{lat:1,lng:104},HK:{lat:22,lng:114},FI:{lat:64,lng:26},SE:{lat:62,lng:15},NO:{lat:62,lng:10},DK:{lat:56,lng:10},CH:{lat:47,lng:8},AT:{lat:47,lng:14},BE:{lat:50,lng:4},IT:{lat:42,lng:12},ES:{lat:40,lng:-4},PT:{lat:39,lng:-8},PL:{lat:52,lng:20},CZ:{lat:49,lng:15},RO:{lat:46,lng:25},BG:{lat:43,lng:25},HU:{lat:47,lng:20},UA:{lat:49,lng:32},RU:{lat:61,lng:105},TR:{lat:39,lng:35},IN:{lat:20,lng:77},BR:{lat:-14,lng:-51},MX:{lat:23,lng:-102},KR:{lat:36,lng:128},SA:{lat:24,lng:45},ZA:{lat:-29,lng:24},AE:{lat:24,lng:54},IR:{lat:32,lng:53},IE:{lat:53,lng:-8},LT:{lat:56,lng:24},LV:{lat:57,lng:25},EE:{lat:59,lng:26},SK:{lat:48,lng:19},SI:{lat:46,lng:15},HR:{lat:45,lng:16},RS:{lat:44,lng:21},GR:{lat:39,lng:22},CL:{lat:-30,lng:-71},CO:{lat:4,lng:-72},AR:{lat:-34,lng:-64}};
let data=null,chartInstances={};
async function loadData(){try{const r=await fetch('results.json?'+Date.now());if(!r.ok)throw 0;data=await r.json();render();renderMap();renderSpeed();renderCensor();renderGame();}catch(e){document.getElementById('sec-overview').innerHTML='<div class="no-data"><p>داده‌ای موجود نیست...</p></div>';}}
function getFlag(c){return FLAGS[(c||'').toUpperCase()]||'🌐'}
function showSection(id){document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));document.getElementById('sec-'+id).classList.add('active');document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');if(id==='map')renderMap();}
function render(){if(!data)return;const s=data.summary||{};document.getElementById('totalFetched').textContent=(s.totalFetched||0).toLocaleString();document.getElementById('aliveCount').textContent=(s.alive||0).toLocaleString();document.getElementById('tlsCount').textContent=(s.tlsOk||0).toLocaleString();document.getElementById('filteredCount').textContent=(s.passedFilter||0).toLocaleString();const h=data.health||{};const t=(h.healthyServers||0)+(h.unstableServers||0)+(h.deadServers||0)||1;document.getElementById('healthyCount').textContent=h.healthyServers||'-';document.getElementById('unstableCount').textContent=h.unstableServers||'-';document.getElementById('deadCount').textContent=h.deadServers||'-';document.getElementById('healthyBar').style.width=((h.healthyServers||0)/t*100)+'%';document.getElementById('unstableBar').style.width=((h.unstableServers||0)/t*100)+'%';document.getElementById('deadBar').style.width=((h.deadServers||0)/t*100)+'%';document.getElementById('refreshInfo').textContent='آخرین بروزرسانی: '+(data.timestamp||'-');renderCharts();renderTable(data.configs||[]);}
function renderCharts(){const opts={responsive:true,plugins:{legend:{labels:{color:'#aaa',font:{size:11}}}}};const sc={x:{ticks:{color:'#888',font:{size:10}},grid:{color:'#1a1a3e'}},y:{ticks:{color:'#888',font:{size:10}},grid:{color:'#1a1a3e'}}};if(chartInstances.protocol)chartInstances.protocol.destroy();const proto=data.byProtocol||{};chartInstances.protocol=new Chart(document.getElementById('protocolChart'),{type:'doughnut',data:{labels:Object.keys(proto).map(k=>k.toUpperCase()),datasets:[{data:Object.values(proto),backgroundColor:COLORS}]},options:{...opts,plugins:{legend:{position:'bottom',labels:{color:'#aaa',padding:8,font:{size:10}}}}}});if(chartInstances.country)chartInstances.country.destroy();const countries=Object.fromEntries(Object.entries(data.byCountry||{}).slice(0,10));chartInstances.country=new Chart(document.getElementById('countryChart'),{type:'bar',data:{labels:Object.keys(countries).map(c=>getFlag(c)+' '+c),datasets:[{data:Object.values(countries),backgroundColor:COLORS}]},options:{...opts,indexAxis:'y',plugins:{legend:{display:false}},scales:sc}});const configs=data.configs||[];const latencies=configs.filter(c=>c.latency&&c.latency<5000).map(c=>c.latency);const lb={'<100':0,'100-300':0,'300-500':0,'500-1k':0,'1k-2k':0,'>2k':0};latencies.forEach(l=>{if(l<100)lb['<100']++;else if(l<300)lb['100-300']++;else if(l<500)lb['300-500']++;else if(l<1000)lb['500-1k']++;else if(l<2000)lb['1k-2k']++;else lb['>2k']++});if(chartInstances.latency)chartInstances.latency.destroy();chartInstances.latency=new Chart(document.getElementById('latencyChart'),{type:'bar',data:{labels:Object.keys(lb),datasets:[{data:Object.values(lb),backgroundColor:['#22c55e','#3b82f6','#f59e0b','#f97316','#ef4444','#991b1b']}]},options:{...opts,plugins:{legend:{display:false}},scales:sc}});const scores=configs.filter(c=>c.score!==undefined).map(c=>c.score);const sb={'0-20':0,'20-40':0,'40-60':0,'60-80':0,'80-100':0};scores.forEach(s=>{if(s<20)sb['0-20']++;else if(s<40)sb['20-40']++;else if(s<60)sb['40-60']++;else if(s<80)sb['60-80']++;else sb['80-100']++});if(chartInstances.score)chartInstances.score.destroy();chartInstances.score=new Chart(document.getElementById('scoreChart'),{type:'bar',data:{labels:Object.keys(sb),datasets:[{data:Object.values(sb),backgroundColor:['#991b1b','#ef4444','#f59e0b','#3b82f6','#22c55e']}]},options:{...opts,plugins:{legend:{display:false}},scales:sc}});}
function renderTable(configs){const tb=document.getElementById('serverTable');document.getElementById('serverCount').textContent=configs.length;if(!configs.length){tb.innerHTML='<tr><td colspan="9" class="no-data">داده‌ای نیست</td></tr>';return}tb.innerHTML=configs.map((c,i)=>{const cls=c.alive?'alive':'dead';const pb=c.protocol==='vless'?'badge-green':c.protocol==='vmess'?'badge-blue':c.protocol==='trojan'?'badge-purple':'badge-gray';const lat=c.latency||'-';const lc=typeof lat==='number'?(lat<200?'badge-green':lat<500?'badge-blue':lat<1000?'badge-yellow':'badge-red'):'badge-gray';return '<tr><td>'+(i+1)+'</td><td><span class="status-dot '+cls+'"></span>'+(c.alive?'فعال':'❌')+'</td><td><span class="server-name">MRCODAD '+(c.flag||getFlag(c.country))+' Node-'+String(i+1).padStart(3,'0')+'</span></td><td><span class="badge '+pb+'">'+(c.protocol||'?').toUpperCase()+'</span></td><td style="direction:ltr;text-align:left;font-family:monospace;font-size:11px">'+(c.host||'-')+'</td><td>'+c.port+'</td><td>'+(c.flag||getFlag(c.country))+' '+(c.country||'?')+'</td><td><span class="badge '+lc+'">'+lat+(typeof lat==='number'?'ms':'')+'</span></td><td><strong>'+(c.score||0)+'</strong></td></tr>'}).join('');}
document.getElementById('searchBox').addEventListener('input',function(){if(!data)return;const q=this.value.toLowerCase();renderTable((data.configs||[]).filter(c=>(c.host||'').toLowerCase().includes(q)||(c.protocol||'').includes(q)||(c.country||'').toLowerCase().includes(q)));});
// Map
function renderMap(){const map=document.getElementById('worldMap');if(!map||!data)return;map.innerHTML='';const configs=data.configs||[];const mapW=map.offsetWidth||800;const mapH=map.offsetHeight||400;configs.forEach(c=>{const g=GEO[c.country];if(!g)return;const x=((g.lng+180)/360)*mapW;const y=((90-g.lat)/180)*mapH;const dot=document.createElement('div');dot.className='map-dot '+(c.alive?'alive':'dead');dot.style.left=x+'px';dot.style.top=y+'px';dot.dataset.tip=MRCODAD '+(c.flag||getFlag(c.country))+' | '+(c.host||'?')+':'+c.port+' | '+(c.latency||'-')+'ms';map.appendChild(dot);});if(chartInstances.geo)chartInstances.geo.destroy();const countries={};configs.forEach(c=>{if(c.country){countries[c.country]=(countries[c.country]||0)+1;}});chartInstances.geo=new Chart(document.getElementById('geoChart'),{type:'bar',data:{labels:Object.keys(countries).slice(0,15).map(c=>getFlag(c)+' '+c),datasets:[{data:Object.values(countries).slice(0,15),backgroundColor:COLORS}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#888'},grid:{color:'#1a1a3e'}},y:{ticks:{color:'#888'},grid:{color:'#1a1a3e'}}}}});
// Speed
function renderSpeed(){if(!data)return;const configs=(data.configs||[]).filter(c=>c.alive&&c.latency);configs.sort((a,b)=>(a.latency||9999)-(b.latency||9999));const grid=document.getElementById('speedGrid');if(!grid)return;if(configs.length===0){grid.innerHTML='<div class="no-data">داده سرعت موجود نیست</div>';return}const speeds=configs.map(c=>{const estSpeed=c.latency<100?Math.round(800/c.latency*100):c.latency<300?Math.round(400/c.latency*100):c.latency<500?Math.round(200/c.latency*100):Math.round(100/c.latency*100);return{...c,estSpeed};}).filter(c=>c.estSpeed>0);speeds.sort((a,b)=>b.estSpeed-a.estSpeed);const avg=Math.round(speeds.reduce((a,b)=>a+b.estSpeed,0)/speeds.length);const best=Math.max(...speeds.map(c=>c.estSpeed));const avgLat=Math.round(configs.reduce((a,b)=>a+b.latency,0)/configs.length);document.getElementById('avgSpeed').textContent=fmtSpeed(avg);document.getElementById('bestSpeed').textContent=fmtSpeed(best);document.getElementById('avgLatency').textContent=avgLat+'ms';grid.innerHTML=speeds.slice(0,20).map(c=>{const g=c.estSpeed>=200?'A':c.estSpeed>=100?'B':c.estSpeed>=50?'C':'D';const gc=g==='A'?'#22c55e':g==='B'?'#3b82f6':g==='C'?'#f59e0b':'#ef4444';return '<div class="speed-card"><div style="font-size:20px">'+getFlag(c.country)+'</div><div class="grade" style="color:'+gc+'">'+g+'</div><div class="speed-val">'+fmtSpeed(c.estSpeed)+'</div><div class="server-info">'+(c.host||'?')+':'+c.port+'</div><div style="margin-top:4px"><span class="badge badge-green">'+c.latency+'ms</span></div></div>'}).join('');}
function fmtSpeed(kbs){return kbs>=1024?(kbs/1024).toFixed(1)+' MB/s':kbs+' KB/s';}
// Censor
function renderCensor(){if(!data)return;const configs=data.configs||[];const accessible=configs.filter(c=>c.alive).length;const blocked=configs.filter(c=>!c.alive).length;const total=configs.length||1;const stats=document.getElementById('censorStats');if(stats){stats.innerHTML='<div class="censor-card"><div class="score" style="color:#22c55e">'+accessible+'</div><div class="label">🟢 سرورهای قابل دسترس</div><div class="risk-bar"><div class="risk-fill" style="width:'+(accessible/total*100)+'%;background:#22c55e"></div></div></div><div class="censor-card"><div class="score" style="color:#ef4444">'+blocked+'</div><div class="label">🔴 سرورهای احتمالاً مسدود</div><div class="risk-bar"><div class="risk-fill" style="width:'+(blocked/total*100)+'%;background:#ef4444"></div></div></div><div class="censor-card"><div class="score" style="color:#fbbf24">'+Math.round(accessible/total*100)+'%</div><div class="label">📊 درصد دسترسی</div><div class="risk-bar"><div class="risk-fill" style="width:'+(accessible/total*100)+'%;background:linear-gradient(90deg,#ef4444,#f59e0b,#22c55e)"></div></div></div>';}const tb=document.getElementById('censorTable');if(tb){tb.innerHTML=configs.map((c,i)=>{const proto=c.protocol||'?';const sec=c.security||c.tlsOk?'🔒':'🔓';const risk=c.alive?'badge-green':'badge-red';const riskText=c.alive?'✅ ایمن':'⚠️ مسدود';const score=c.score||0;const sc=score>=70?'badge-green':score>=40?'badge-yellow':'badge-red';return '<tr><td>'+(i+1)+'</td><td style="direction:ltr;font-family:monospace;font-size:11px">'+(c.host||'-')+'</td><td><span class="badge badge-blue">'+proto.toUpperCase()+'</span></td><td>'+sec+'</td><td>'+c.port+'</td><td><span class="badge '+risk+'">'+riskText+'</span></td><td><span class="badge '+sc+'">'+score+'</span></td><td><span class="badge '+(c.alive?'badge-green':'badge-red')+'">'+(c.alive?'🟢':'🔴')+'</span></td></tr>'}).join('');}}
// Gamification
function renderGame(){if(!data)return;const g=data.gamification||{};document.getElementById('totalTests').textContent=(g.totalTests||data.summary?.tested||0).toLocaleString();document.getElementById('totalUsers').textContent=(g.totalUsers||0).toLocaleString();document.getElementById('activeToday').textContent=(g.activeToday||0).toLocaleString();document.getElementById('totalServers').textContent=(data.summary?.passedFilter||0).toLocaleString();const lb=document.getElementById('leaderboard');const top=g.topUsers||[];if(lb){if(top.length===0){lb.innerHTML='<div class="no-data" style="padding:20px">هنوز کاربری ثبت‌نام نکرده. با ربات تلگرام شروع کنید!</div>';}else{lb.innerHTML=top.map(u=>{const rankCls=u.rank<=3?'rank-'+u.rank:'';return '<div class="leaderboard-row"><span class="rank '+rankCls+'">'+u.rank+'</span><span class="medal">'+(u.level?.medal||'')+'</span><span class="username">'+(u.username||u.userId)+'</span><span style="color:#888;font-size:11px">Lv.'+(u.level?.level||1)+'</span><span class="user-points">'+u.points.toLocaleString()+' ⭐</span></div>'}).join('');}}}
loadData();setInterval(loadData,5*60*1000);
</script>
</body>
</html>`;

export function generateDashboard(resultsJson) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(path.join(distDir, 'index.html'), DASHBOARD_HTML, 'utf-8');

  if (resultsJson) {
    fs.writeFileSync(path.join(distDir, 'results.json'), JSON.stringify(resultsJson, null, 2), 'utf-8');
  }

  console.log('[Dashboard] Generated with map, speed, anti-censor, gamification.');
}

export function generateApiFiles(configs) {
  const apiDir = path.join(process.cwd(), 'dist', 'api');
  if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });

  const plainConfigs = configs.map(c => c.raw).filter(Boolean);

  fs.writeFileSync(
    path.join(apiDir, 'configs.json'),
    JSON.stringify({ total: plainConfigs.length, configs: plainConfigs }, null, 2),
    'utf-8'
  );

  const byProtocol = {};
  for (const c of configs) {
    const p = c.protocol || 'unknown';
    if (!byProtocol[p]) byProtocol[p] = [];
    if (c.raw) byProtocol[p].push(c.raw);
  }
  for (const [proto, cfgs] of Object.entries(byProtocol)) {
    fs.writeFileSync(
      path.join(apiDir, `${proto}.json`),
      JSON.stringify({ protocol: proto, total: cfgs.length, configs: cfgs }, null, 2),
      'utf-8'
    );
  }

  const byCountry = {};
  for (const c of configs) {
    if (!c.country) continue;
    if (!byCountry[c.country]) byCountry[c.country] = [];
    if (c.raw) byCountry[c.country].push(c.raw);
  }
  for (const [country, cfgs] of Object.entries(byCountry)) {
    fs.writeFileSync(
      path.join(apiDir, `${country.toLowerCase()}.json`),
      JSON.stringify({ country, total: cfgs.length, configs: cfgs }, null, 2),
      'utf-8'
    );
  }

  console.log(`[API] Generated ${Object.keys(byProtocol).length} protocol + ${Object.keys(byCountry).length} country files.`);
}
