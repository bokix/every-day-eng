/**
 * 清空学习记录(保留词库),用于重置进度
 * 用法: node scripts/reset-progress.js
 */
const { getDb } = require('../src/db');

const db = getDb();
db.exec('DELETE FROM study_log');
db.exec(`UPDATE progress SET
  status='new', ease_factor=2.5, interval_days=0, repetitions=0,
  consecutive_correct=0, next_review=date('now','localtime'),
  last_review=NULL, mastered_at=NULL, total_seen=0, total_correct=0`);

const logCount = db.prepare('SELECT COUNT(*) c FROM study_log').get().c;
const progCount = db.prepare('SELECT COUNT(*) c FROM progress').get().c;
const newCount = db.prepare("SELECT COUNT(*) c FROM progress WHERE status='new'").get().c;
console.log(`已清空 study_log (${logCount} 条)`);
console.log(`progress 已重置: 共 ${progCount} 条,其中 new 状态 ${newCount} 条`);
