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
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f23;color:#e0e0e0;min-height:100vh}
.header{background:linear-gradient(135deg,#1a1a3e 0%,#0d0d2b 100%);padding:30px 20px;text-align:center;border-bottom:2px solid #2a2a5a}
.header h1{font-size:28px;margin-bottom:8px;background:linear-gradient(90deg,#00d4ff,#7c3aed,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.header p{color:#8888aa;font-size:14px}
.container{max-width:1200px;margin:0 auto;padding:20px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:30px}
.stat-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:24px;text-align:center;border:1px solid #2a2a5a;transition:transform .2s,box-shadow .2s}
.stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(0,0,0,0.3)}
.stat-icon{font-size:32px;margin-bottom:8px}
.stat-value{font-size:36px;font-weight:700;margin-bottom:4px}
.stat-label{color:#8888aa;font-size:13px;text-transform:uppercase;letter-spacing:1px}
.stat-card.alive .stat-value{color:#22c55e}
.stat-card.tls .stat-value{color:#3b82f6}
.stat-card.filtered .stat-value{color:#a855f7}
.stat-card.total .stat-value{color:#f59e0b}
.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}
.chart-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:20px;border:1px solid #2a2a5a}
.chart-card h3{color:#ccc;font-size:15px;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid #2a2a5a}
.table-card{background:linear-gradient(135deg,#1a1a3e,#12122e);border-radius:12px;padding:20px;border:1px solid #2a2a5a;margin-bottom:30px}
.table-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px}
.table-header h3{color:#ccc;font-size:15px}
.search-box{background:#0f0f23;border:1px solid #2a2a5a;color:#e0e0e0;padding:8px 14px;border-radius:8px;font-size:13px;width:220px;outline:none;transition:border-color .2s}
.search-box:focus{border-color:#7c3aed}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:#052e16;color:#22c55e;border:1px solid #166534}
.badge-red{background:#450a0a;color:#ef4444;border:1px solid #991b1b}
.badge-blue{background:#0c1e3d;color:#60a5fa;border:1px solid #1e40af}
.badge-purple{background:#2e1065;color:#c084fc;border:1px solid #6b21a8}
.badge-gray{background:#1f2937;color:#9ca3af;border:1px solid #374151}
table{width:100%;border-collapse:collapse}
th{text-align:right;padding:12px 10px;color:#8888aa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #2a2a5a}
td{padding:10px;border-bottom:1px solid #1a1a3e;font-size:13px}
tr:hover td{background:rgba(124,58,237,0.05)}
.footer{text-align:center;padding:20px;color:#555;font-size:12px;border-top:1px solid #1a1a3e}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:6px}
.status-dot.alive{background:#22c55e;box-shadow:0 0 6px #22c55e}
.status-dot.dead{background:#ef4444;box-shadow:0 0 6px #ef4444}
.refresh-info{color:#666;font-size:11px;margin-top:5px}
.no-data{text-align:center;padding:60px 20px;color:#555}
.no-data p{font-size:16px;margin-top:10px}
@media(max-width:768px){.stats-grid{grid-template-columns:repeat(2,1fr)}.charts-grid{grid-template-columns:1fr}.stat-value{font-size:28px}.header h1{font-size:22px}}
@media(max-width:480px){.stats-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="header">
  <h1>MRCODAD V2Ray Subscription Dashboard</h1>
  <p>سیستم جمع‌آوری، تست و فیلتر هوشمند کانفیگ‌های V2Ray</p>
  <div class="refresh-info" id="refreshInfo"></div>
</div>
<div class="container">
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card total"><div class="stat-icon">📦</div><div class="stat-value" id="totalFetched">-</div><div class="stat-label">کل کانفیگ‌ها</div></div>
    <div class="stat-card alive"><div class="stat-icon">✅</div><div class="stat-value" id="aliveCount">-</div><div class="stat-label">سرور زنده</div></div>
    <div class="stat-card tls"><div class="stat-icon">🔒</div><div class="stat-value" id="tlsCount">-</div><div class="stat-label">TLS موفق</div></div>
    <div class="stat-card filtered"><div class="stat-icon">⭐</div><div class="stat-value" id="filteredCount">-</div><div class="stat-label">نهایی (فیلتر شده)</div></div>
  </div>
  <div class="charts-grid">
    <div class="chart-card"><h3>توزیع پروتکل‌ها</h3><canvas id="protocolChart"></canvas></div>
    <div class="chart-card"><h3>توزیع کشورها</h3><canvas id="countryChart"></canvas></div>
    <div class="chart-card"><h3>پینگ سرورها (ms)</h3><canvas id="latencyChart"></canvas></div>
    <div class="chart-card"><h3>توزیع امتیاز</h3><canvas id="scoreChart"></canvas></div>
  </div>
  <div class="table-card">
    <div class="table-header">
      <h3>لیست سرورها (<span id="serverCount">0</span>)</h3>
      <input type="text" class="search-box" id="searchBox" placeholder="جستجو...">
    </div>
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>#</th><th>وضعیت</th><th>پروتکل</th><th>آدرس سرور</th><th>پورت</th><th>کشور</th><th>پینگ</th><th>امتیاز</th></tr></thead>
        <tbody id="serverTable"></tbody>
      </table>
    </div>
  </div>
</div>
<div class="footer">MRCODAD V2Ray Subscription Platform &mdash; بروزرسانی خودکار هر ۱۵ دقیقه</div>
<script>
const COLORS=['#7c3aed','#3b82f6','#22c55e','#f59e0b','#ef4444','#ec4899','#06b6d4','#8b5cf6','#10b981','#f97316','#6366f1','#14b8a6'];
let data=null;
async function loadData(){
  try{
    const r=await fetch('results.json?'+Date.now());
    if(!r.ok)throw new Error('No data');
    data=await r.json();
    render();
  }catch(e){
    document.getElementById('statsGrid').innerHTML='<div class="no-data"><p>داده‌ای موجود نیست. اولین اجرا در حال انجام است...</p></div>';
  }
}
function render(){
  if(!data)return;
  const s=data.summary||{};
  document.getElementById('totalFetched').textContent=(s.totalFetched||0).toLocaleString();
  document.getElementById('aliveCount').textContent=(s.alive||0).toLocaleString();
  document.getElementById('tlsCount').textContent=(s.tlsOk||0).toLocaleString();
  document.getElementById('filteredCount').textContent=(s.passedFilter||0).toLocaleString();
  document.getElementById('refreshInfo').textContent='آخرین بروزرسانی: '+(data.timestamp||'-');
  renderCharts();
  renderTable(data.configs||[]);
}
function renderCharts(){
  const chartDefaults={responsive:true,plugins:{legend:{labels:{color:'#aaa',font:{size:12}}}},scales:{}};
  const scaleDefaults={x:{ticks:{color:'#888'},grid:{color:'#1a1a3e'}},y:{ticks:{color:'#888'},grid:{color:'#1a1a3e'}}};
  const proto=data.byProtocol||{};
  new Chart(document.getElementById('protocolChart'),{type:'doughnut',data:{labels:Object.keys(proto),datasets:[{data:Object.values(proto),backgroundColor:COLORS}]},options:{...chartDefaults,plugins:{legend:{position:'bottom',labels:{color:'#aaa',padding:12}}}}});
  const countries=Object.fromEntries(Object.entries(data.byCountry||{}).slice(0,12));
  new Chart(document.getElementById('countryChart'),{type:'bar',data:{labels:Object.keys(countries),datasets:[{label:'سرور',data:Object.values(countries),backgroundColor:COLORS.slice(0,Object.keys(countries).length)}]},options:{...chartDefaults,indexAxis:'y',plugins:{legend:{display:false}},scales:scaleDefaults}});
  const configs=data.configs||[];
  const latencies=configs.filter(c=>c.latency&&c.latency<5000).map(c=>c.latency);
  const latBuckets={'<100ms':0,'100-300ms':0,'300-500ms':0,'500-1s':0,'1-2s':0,'>2s':0};
  latencies.forEach(l=>{if(l<100)latBuckets['<100ms']++;else if(l<300)latBuckets['100-300ms']++;else if(l<500)latBuckets['300-500ms']++;else if(l<1000)latBuckets['500-1s']++;else if(l<2000)latBuckets['1-2s']++;else latBuckets['>2s']++});
  new Chart(document.getElementById('latencyChart'),{type:'bar',data:{labels:Object.keys(latBuckets),datasets:[{label:'تعداد',data:Object.values(latBuckets),backgroundColor:['#22c55e','#3b82f6','#f59e0b','#f97316','#ef4444','#991b1b']}]},options:{...chartDefaults,plugins:{legend:{display:false}},scales:scaleDefaults}});
  const scores=configs.filter(c=>c.score!==undefined).map(c=>c.score);
  const scoreBuckets={'0-20':0,'20-40':0,'40-60':0,'60-80':0,'80-100':0};
  scores.forEach(s=>{if(s<20)scoreBuckets['0-20']++;else if(s<40)scoreBuckets['20-40']++;else if(s<60)scoreBuckets['40-60']++;else if(s<80)scoreBuckets['60-80']++;else scoreBuckets['80-100']++});
  new Chart(document.getElementById('scoreChart'),{type:'bar',data:{labels:Object.keys(scoreBuckets),datasets:[{label:'تعداد',data:Object.values(scoreBuckets),backgroundColor:['#991b1b','#ef4444','#f59e0b','#3b82f6','#22c55e']}]},options:{...chartDefaults,plugins:{legend:{display:false}},scales:scaleDefaults}});
}
function renderTable(configs){
  const tbody=document.getElementById('serverTable');
  document.getElementById('serverCount').textContent=configs.length;
  if(!configs.length){tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:40px;color:#555">داده‌ای موجود نیست</td></tr>';return}
  tbody.innerHTML=configs.map((c,i)=>{
    const cls=c.alive?'alive':'dead';
    const proto=c.protocol||'?';
    const protoBadge=proto==='vless'?'badge-green':proto==='vmess'?'badge-blue':proto==='trojan'?'badge-purple':'badge-gray';
    const latency=c.latency||'-';
    const latencyClass=latency<200?'badge-green':latency<500?'badge-blue':latency<1000?'badge-yellow':'badge-red';
    return '<tr><td>'+(i+1)+'</td><td><span class="status-dot '+cls+'"></span>'+(c.alive?'فعال':'غیرفعال')+'</td><td><span class="badge '+protoBadge+'">'+proto.toUpperCase()+'</span></td><td style="direction:ltr;text-align:left;font-family:monospace;font-size:12px">'+(c.host||'-')+'</td><td>'+c.port+'</td><td>'+(c.country||'<span class="badge badge-gray">?</span>')+'</td><td><span class="badge '+latencyClass+'">'+latency+'ms</span></td><td><strong>'+(c.score||0)+'</strong></td></tr>';
  }).join('');
}
document.getElementById('searchBox').addEventListener('input',function(){
  if(!data||!data.configs)return;
  const q=this.value.toLowerCase();
  const filtered=data.configs.filter(c=>(c.host||'').toLowerCase().includes(q)||(c.protocol||'').toLowerCase().includes(q)||(c.country||'').toLowerCase().includes(q));
  renderTable(filtered);
});
loadData();
setInterval(loadData,5*60*1000);
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

  console.log('[Dashboard] index.html and results.json generated.');
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
