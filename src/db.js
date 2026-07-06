const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'vocab.db');

let db = null;

function getDb() {
  if (db) return db;
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      phonetic TEXT,
      meaning TEXT,
      freq INTEGER DEFAULT 0,
      pos TEXT,
      example TEXT,
      example_cn TEXT,
      root_mnemonic TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'new',  -- new / learning / mastered / verified
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      consecutive_correct INTEGER NOT NULL DEFAULT 0,
      next_review TEXT,                     -- 到期日期(本地日期 YYYY-MM-DD)
      last_review TEXT,
      mastered_at TEXT,
      total_seen INTEGER NOT NULL DEFAULT 0,
      total_correct INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

    CREATE TABLE IF NOT EXISTS study_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      date TEXT NOT NULL,                   -- YYYY-MM-DD
      ts TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      session TEXT,                         -- 早/中/晚 或自动
      action TEXT NOT NULL,                 -- study / review / test
      result TEXT NOT NULL,                 -- correct / wrong
      mode TEXT,                            -- flashcard / choice / spelling
      FOREIGN KEY (word_id) REFERENCES words(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_progress_status ON progress(status);
    CREATE INDEX IF NOT EXISTS idx_progress_next ON progress(next_review);
    CREATE INDEX IF NOT EXISTS idx_log_date ON study_log(date);
  `);
}

module.exports = { getDb, DB_PATH };
