/**
 * 导入词库到数据库
 * 用法: node scripts/import-words.js
 */
const fs = require('fs');
const path = require('path');
const { getDb } = require('../src/db');
const { buildMnemonic } = require('../src/roots');

const WORDS_JSON = path.join(__dirname, '..', 'doc', 'words-raw.json');

function run() {
  const db = getDb();
  const raw = JSON.parse(fs.readFileSync(WORDS_JSON, 'utf-8'));
  console.log('待导入单词数:', raw.length);

  const insertWord = db.prepare(`
    INSERT INTO words (word, phonetic, meaning, freq, root_mnemonic)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(word) DO UPDATE SET
      phonetic = excluded.phonetic,
      meaning = excluded.meaning,
      freq = excluded.freq,
      root_mnemonic = excluded.root_mnemonic
  `);

  const insertProgress = db.prepare(`
    INSERT OR IGNORE INTO progress (word_id, status, next_review)
    VALUES (?, 'new', ?)
  `);

  const today = new Date().toISOString().slice(0, 10);

  const tx = db.transaction((items) => {
    let imported = 0;
    let withMnemonic = 0;
    for (const w of items) {
      const mnemonic = buildMnemonic(w.word);
      if (mnemonic) withMnemonic++;
      const info = insertWord.run(w.word, w.phonetic || '', w.meaning || '', w.freq || 0, mnemonic);
      if (info.changes > 0) {
        // 新插入的,建进度记录
        insertProgress.run(info.lastInsertRowid, today);
        imported++;
      }
    }
    return { imported, withMnemonic };
  });

  const { imported, withMnemonic } = tx(raw);
  const total = db.prepare('SELECT COUNT(*) as c FROM words').get().c;
  const progressCount = db.prepare('SELECT COUNT(*) as c FROM progress').get().c;
  console.log(`本次新导入: ${imported}, 词库总数: ${total}, 进度记录: ${progressCount}`);
  console.log(`生成词根助记: ${withMnemonic} / ${raw.length} (${Math.round(withMnemonic / raw.length * 100)}%)`);

  // 抽样展示助记效果
  const samples = db.prepare(`SELECT word, root_mnemonic FROM words WHERE root_mnemonic IS NOT NULL LIMIT 8`).all();
  console.log('\n词根助记示例:');
  for (const s of samples) console.log(`  ${s.word}: ${s.root_mnemonic}`);
}

run();
