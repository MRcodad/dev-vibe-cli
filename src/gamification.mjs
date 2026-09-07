import fs from 'fs';
import path from 'path';

const GAMIFICATION_FILE = path.join(process.cwd(), 'dist', 'gamification.json');

// ─── Points & Levels ───

const POINTS = {
  test_server: 2,
  report_blocked: 10,
  daily_checkin: 5,
  invite_user: 20,
  find_new_server: 15,
  speed_test: 3,
  report_accuracy: 8,
};

const LEVELS = [
  { level: 1, name: 'تازه‌کار', medal: '', minPoints: 0 },
  { level: 2, name: 'کاوشگر', medal: '🥉', minPoints: 50 },
  { level: 3, name: 'تستر', medal: '🥈', minPoints: 150 },
  { level: 4, name: 'کارشناس', medal: '🥇', minPoints: 350 },
  { level: 5, name: 'استاد', medal: '🏆', minPoints: 700 },
  { level: 6, name: 'ارباب', medal: '👑', minPoints: 1200 },
  { level: 7, name: 'افسانه', medal: '⚡', minPoints: 2000 },
  { level: 8, name: 'خدای VPN', medal: '🔥', minPoints: 3500 },
];

const BADGES = [
  { id: 'first_test', name: 'اولین تست', desc: 'اولین سرور رو تست کردی', icon: '🎯', requirement: 1 },
  { id: 'test_10', name: 'تستر حرفه‌ای', desc: '۱۰ سرور تست کردی', icon: '🔬', requirement: 10 },
  { id: 'test_50', name: 'تستر الماسی', desc: '۵۰ سرور تست کردی', icon: '💎', requirement: 50 },
  { id: 'test_100', name: 'تستر افسانه‌ای', desc: '۱۰۰ سرور تست کردی', icon: '🌟', requirement: 100 },
  { id: 'speed_king', name: 'پادشاه سرعت', desc: 'سریع‌ترین سرور رو پیدا کردی', icon: '⚡', requirement: 0 },
  { id: 'blocked_hunter', name: 'شکارچی بن', desc: '۵ سرور مسدود گزارش کردی', icon: '🛡', requirement: 5 },
  { id: 'streak_7', name: '۷ روز متوالی', desc: '۷ روز پشت سر هم فعال بودی', icon: '🔥', requirement: 7 },
  { id: 'country_explorer', name: 'کاشف جهانی', desc: 'از ۵ کشور مختلف تست کردی', icon: '🌍', requirement: 5 },
];

// ─── Data Management ───

function loadData() {
  try {
    if (fs.existsSync(GAMIFICATION_FILE)) {
      return JSON.parse(fs.readFileSync(GAMIFICATION_FILE, 'utf8'));
    }
  } catch {}
  return { users: {}, globalStats: { totalTests: 0, totalUsers: 0 } };
}

function saveData(data) {
  const distDir = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(GAMIFICATION_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function getUser(data, userId) {
  if (!data.users[userId]) {
    data.users[userId] = {
      id: userId,
      username: '',
      points: 0,
      level: 1,
      medals: [],
      badges: [],
      stats: {
        tests: 0,
        blockedReports: 0,
        speedTests: 0,
        checkIns: [],
        countries: [],
        bestSpeed: 0,
      },
      createdAt: new Date().toISOString(),
    };
  }
  return data.users[userId];
}

// ─── Actions ───

export function addPoints(userId, action, metadata = {}) {
  const data = loadData();
  const user = getUser(data, userId);

  if (metadata.username) user.username = metadata.username;

  const points = POINTS[action] || 0;
  user.points += points;

  // Update stats
  if (action === 'test_server') {
    user.stats.tests++;
    data.globalStats.totalTests++;
  }
  if (action === 'report_blocked') user.stats.blockedReports++;
  if (action === 'speed_test') user.stats.speedTests++;
  if (action === 'daily_checkin') {
    const today = new Date().toISOString().split('T')[0];
    if (!user.stats.checkIns.includes(today)) {
      user.stats.checkIns.push(today);
      if (user.stats.checkIns.length > 30) user.stats.checkIns.shift();
    }
  }

  // Track countries
  if (metadata.country && !user.stats.countries.includes(metadata.country)) {
    user.stats.countries.push(metadata.country);
  }

  // Track best speed
  if (metadata.speed && metadata.speed > user.stats.bestSpeed) {
    user.stats.bestSpeed = metadata.speed;
  }

  // Update level
  user.level = getLevel(user.points).level;

  // Check badges
  checkBadges(user);

  // Update global stats
  data.globalStats.totalUsers = Object.keys(data.users).length;

  saveData(data);

  return {
    points,
    totalPoints: user.points,
    level: getLevel(user.points),
    newBadges: user.badges.filter(b => b.newlyEarned).map(b => b.name),
  };
}

export function checkIn(userId, username) {
  return addPoints(userId, 'daily_checkin', { username });
}

export function getLeaderboard(limit = 20) {
  const data = loadData();

  return Object.values(data.users)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit)
    .map((user, i) => ({
      rank: i + 1,
      userId: user.id,
      username: user.username || user.id,
      points: user.points,
      level: getLevel(user.points),
      tests: user.stats.tests,
    }));
}

export function getUserProfile(userId) {
  const data = loadData();
  const user = getUser(data, userId);
  const level = getLevel(user.points);
  const nextLevel = getNextLevel(user.points);

  return {
    ...user,
    level,
    nextLevel,
    progress: nextLevel ? Math.round(((user.points - level.minPoints) / (nextLevel.minPoints - level.minPoints)) * 100) : 100,
    streak: getStreak(user),
  };
}

export function getGlobalStats() {
  const data = loadData();
  const leaderboard = getLeaderboard(10);

  return {
    totalTests: data.globalStats.totalTests,
    totalUsers: Object.keys(data.users).length,
    topUsers: leaderboard,
    activeToday: Object.values(data.users).filter(u => {
      const today = new Date().toISOString().split('T')[0];
      return u.stats.checkIns.includes(today);
    }).length,
  };
}

// ─── Helpers ───

function getLevel(points) {
  let result = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minPoints) result = level;
  }
  return result;
}

function getNextLevel(points) {
  for (const level of LEVELS) {
    if (points < level.minPoints) return level;
  }
  return null;
}

function getStreak(user) {
  const checkIns = user.stats.checkIns.sort().reverse();
  if (checkIns.length === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (checkIns.includes(dateStr)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return streak;
}

function checkBadges(user) {
  for (const badge of BADGES) {
    if (user.badges.find(b => b.id === badge.id)) continue;

    let earned = false;

    if (badge.id === 'test_10' && user.stats.tests >= badge.requirement) earned = true;
    if (badge.id === 'test_50' && user.stats.tests >= badge.requirement) earned = true;
    if (badge.id === 'test_100' && user.stats.tests >= badge.requirement) earned = true;
    if (badge.id === 'blocked_hunter' && user.stats.blockedReports >= badge.requirement) earned = true;
    if (badge.id === 'country_explorer' && user.stats.countries.length >= badge.requirement) earned = true;
    if (badge.id === 'streak_7' && getStreak(user) >= badge.requirement) earned = true;

    if (earned) {
      user.badges.push({ ...badge, earnedAt: new Date().toISOString(), newlyEarned: true });
    }
  }
}

export function getLevelDisplay(level) {
  const medal = level.medal || '⬜';
  const bar = '█'.repeat(Math.min(level.level, 8));
  return `${medal} Level ${level.level} — ${level.name} ${bar}`;
}
