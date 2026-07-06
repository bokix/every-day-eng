const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');
const { updateProgress, todayStr } = require('./srs');

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_NEW = parseInt(process.env.DAILY_NEW || '5', 10);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: false, lastModified: false, maxAge: 0 }));

// ---------- 工具 ----------
function getSetting(db, key, def) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : def;
}
function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}

// 今日已学的新词数(按 study_log 中 action=study 统计)
function todayNewCount(db) {
  const today = todayStr();
  const row = db.prepare(`SELECT COUNT(DISTINCT word_id) as c FROM study_log WHERE date=? AND action='study'`).get(today);
  return row.c;
}

// ---------- API: 首页概览 ----------
app.get('/api/overview', (req, res) => {
  const db = getDb();
  const today = todayStr();
  const total = db.prepare('SELECT COUNT(*) c FROM words').get().c;
  const newLeft = db.prepare(`SELECT COUNT(*) c FROM progress WHERE status='new'`).get().c;
  const learning = db.prepare(`SELECT COUNT(*) c FROM progress WHERE status='learning'`).get().c;
  const mastered = db.prepare(`SELECT COUNT(*) c FROM progress WHERE status='mastered'`).get().c;
  const verified = db.prepare(`SELECT COUNT(*) c FROM progress WHERE status='verified'`).get().c;

  // 今日到期复习
  const dueToday = db.prepare(`
    SELECT COUNT(*) c FROM progress
    WHERE status IN ('learning','mastered','verified')
      AND (next_review IS NULL OR next_review <= ?)
  `).get(today).c;

  // 今日已答次数
  const todayAnswered = db.prepare(`SELECT COUNT(*) c FROM study_log WHERE date=?`).get(today).c;
  const todayCorrect = db.prepare(`SELECT COUNT(*) c FROM study_log WHERE date=? AND result='correct'`).get(today).c;
  const todayNew = todayNewCount(db);

  // 假期截止
  const endDate = getSetting(db, 'end_date', '2026-09-01');
  const daysLeft = Math.max(0, Math.ceil((new Date(endDate + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000));

  // 连续打卡
  const streak = computeStreak(db);

  res.json({
    total, newLeft, learning, mastered, verified,
    dueToday, todayAnswered, todayCorrect, todayNew,
    dailyNewTarget: DAILY_NEW,
    endDate, daysLeft, streak,
  });
});

function computeStreak(db) {
  const rows = db.prepare(`SELECT DISTINCT date FROM study_log ORDER BY date DESC LIMIT 400`).all();
  if (rows.length === 0) return 0;
  let streak = 0;
  let cursor = todayStr();
  // 如果今天还没答,从昨天开始算
  if (rows[0].date !== cursor) {
    const y = new Date();
    y.setTime(y.getTime() - 86400000);
    cursor = y.toISOString().slice(0, 10);
    if (rows[0].date !== cursor) return 0;
  }
  const set = new Set(rows.map(r => r.date));
  while (set.has(cursor)) {
    streak++;
    const d = new Date(cursor + 'T00:00:00');
    d.setTime(d.getTime() - 86400000);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

// ---------- API: 获取今日学习/复习队列 ----------
app.get('/api/queue', (req, res) => {
  const db = getDb();
  const today = todayStr();
  const mode = req.query.mode || 'all'; // all / new / review

  const result = { newWords: [], reviewWords: [] };

  // 新词:当天配额内未学过的新词
  const newDone = todayNewCount(db);
  const newRemaining = Math.max(0, DAILY_NEW - newDone);
  if ((mode === 'all' || mode === 'new') && newRemaining > 0) {
    const rows = db.prepare(`
      SELECT w.id, w.word, w.phonetic, w.meaning, w.freq, w.root_mnemonic
      FROM words w JOIN progress p ON p.word_id = w.id
      WHERE p.status = 'new'
      ORDER BY w.freq DESC, w.id ASC
      LIMIT ?
    `).all(newRemaining);
    result.newWords = rows;
  }

  // 复习词:到期需要复习的
  if (mode === 'all' || mode === 'review') {
    const rows = db.prepare(`
      SELECT w.id, w.word, w.phonetic, w.meaning, w.freq, w.root_mnemonic,
             p.status, p.ease_factor, p.interval_days, p.repetitions, p.consecutive_correct
      FROM words w JOIN progress p ON p.word_id = w.id
      WHERE p.status IN ('learning','mastered','verified')
        AND (p.next_review IS NULL OR p.next_review <= ?)
      ORDER BY p.next_review ASC, p.consecutive_correct ASC
      LIMIT 100
    `).all(today);
    result.reviewWords = rows;
  }

  res.json(result);
});

// ---------- API: 提交答题 ----------
app.post('/api/answer', (req, res) => {
  const db = getDb();
  const { word_id, action, result, mode } = req.body; // action: study/review; result: correct/wrong; mode: flashcard/...
  if (!word_id || !result) return res.status(400).json({ error: '缺少参数' });

  const p = db.prepare('SELECT * FROM progress WHERE word_id=?').get(word_id);
  if (!p) return res.status(404).json({ error: '进度不存在' });

  const correct = result === 'correct';
  const updated = updateProgress(p, correct);

  db.prepare(`
    UPDATE progress SET
      status=?, ease_factor=?, interval_days=?, repetitions=?,
      consecutive_correct=?, next_review=?, last_review=?, mastered_at=?,
      total_seen=?, total_correct=?
    WHERE word_id=?
  `).run(updated.status, updated.ease_factor, updated.interval_days, updated.repetitions,
    updated.consecutive_correct, updated.next_review, updated.last_review, updated.mastered_at,
    updated.total_seen, updated.total_correct, word_id);

  const today = todayStr();
  const session = detectSession();
  db.prepare(`INSERT INTO study_log(word_id,date,session,action,result,mode) VALUES(?,?,?,?,?,?)`)
    .run(word_id, today, session, action || 'review', result, mode || 'flashcard');

  res.json({ ok: true, progress: updated });
});

function detectSession() {
  const h = new Date().getHours();
  if (h < 11) return 'morning';
  if (h < 16) return 'noon';
  return 'evening';
}

// ---------- API: 统计 ----------
app.get('/api/stats', (req, res) => {
  const db = getDb();
  const days = parseInt(req.query.days || '30', 10);
  const rows = db.prepare(`
    SELECT date,
      COUNT(*) as total,
      SUM(CASE WHEN result='correct' THEN 1 ELSE 0 END) as correct,
      SUM(CASE WHEN action='study' THEN 1 ELSE 0 END) as studied,
      COUNT(DISTINCT word_id) as words
    FROM study_log
    WHERE date >= date('now','localtime','-${days} days')
    GROUP BY date ORDER BY date ASC
  `).all();

  const statusDist = db.prepare(`
    SELECT status, COUNT(*) c FROM progress GROUP BY status
  `).all();

  // 错得最多的词(需要重点复习)
  const weakWords = db.prepare(`
    SELECT w.word, w.phonetic, w.meaning, p.total_seen, p.total_correct
    FROM progress p JOIN words w ON w.id=p.word_id
    WHERE p.total_seen >= 3
    ORDER BY (CAST(p.total_correct AS REAL) / p.total_seen) ASC
    LIMIT 15
  `).all();

  res.json({ daily: rows, statusDist, weakWords });
});

// ---------- API: 按状态查单词清单 ----------
// status: all | new | learning | mastered | verified
app.get('/api/words', (req, res) => {
  const db = getDb();
  const status = req.query.status || 'all';
  let where = '';
  const params = [];
  if (status === 'mastered') {
    where = 'WHERE p.status IN (?, ?)';
    params.push('mastered', 'verified');
  } else if (status !== 'all') {
    where = 'WHERE p.status = ?';
    params.push(status);
  }
  const rows = db.prepare(`
    SELECT w.word, w.phonetic, w.meaning, w.freq, p.status,
           p.total_seen, p.total_correct, p.next_review
    FROM progress p JOIN words w ON w.id = p.word_id
    ${where}
    ORDER BY w.freq DESC
  `).all(...params);
  res.json({ status, total: rows.length, words: rows });
});

// ---------- API: 自由复习池(纯练习,不刷进度) ----------
// 返回所有 learning/mastered/verified 词,可随时复习,不计入 SM-2
app.get('/api/review-pool', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT w.id, w.word, w.phonetic, w.meaning, w.freq, w.root_mnemonic
    FROM words w JOIN progress p ON p.word_id = w.id
    WHERE p.status IN ('learning','mastered','verified')
    ORDER BY p.consecutive_correct ASC, w.freq DESC
  `).all();
  res.json({ total: rows.length, words: rows });
});

// ---------- API: 设置 ----------
app.get('/api/settings', (req, res) => {
  const db = getDb();
  res.json({
    end_date: getSetting(db, 'end_date', '2026-09-01'),
    daily_new: getSetting(db, 'daily_new', String(DAILY_NEW)),
  });
});
app.post('/api/settings', (req, res) => {
  const db = getDb();
  const { end_date, daily_new } = req.body;
  if (end_date) setSetting(db, 'end_date', end_date);
  if (daily_new) setSetting(db, 'daily_new', daily_new);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`词汇背诵服务已启动: http://localhost:${PORT}`);
  console.log(`局域网访问: http://${getLocalIp()}:${PORT}`);
});

function getLocalIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}
