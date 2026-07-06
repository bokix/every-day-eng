/**
 * SM-2 间隔重复算法 + 掌握度判定
 *
 * 状态流转:
 *   new -> learning -> mastered -> verified
 *
 * 判定规则(假期短,阈值已放宽):
 *   - 每次答题更新 ease_factor / interval / repetitions
 *   - consecutive_correct 连续答对 3 次且 interval >= 7 -> mastered
 *   - mastered 状态进入长期间隔复习
 *   - 长期连续通过 5 次且 interval >= 21 -> verified(基本不再复习)
 *   - 任何状态答错 -> 回到 learning,consecutive_correct 清零,interval 回到 1
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setTime(d.getTime() + days * MS_PER_DAY);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 根据答题结果更新进度
 * @param {object} p - 当前进度记录
 * @param {boolean} correct - 是否答对
 * @returns {object} 更新后的进度字段
 */
function updateProgress(p, correct) {
  let { status, ease_factor, interval_days, repetitions, consecutive_correct } = p;

  if (correct) {
    repetitions += 1;
    consecutive_correct += 1;

    // 新词一旦答过(无论对错),进入 learning 状态
    if (status === 'new') status = 'learning';

    // 计算新间隔(SM-2 变体)
    if (repetitions === 1) {
      interval_days = 1;
    } else if (repetitions === 2) {
      interval_days = 3;
    } else {
      interval_days = Math.max(1, Math.round(interval_days * ease_factor));
    }

    // 掌握度判定:new/learning -> mastered
    // 假期短(约2月),阈值放宽:连续对 3 次 + 间隔 >= 7 天
    if ((status === 'new' || status === 'learning') && consecutive_correct >= 3 && interval_days >= 7) {
      status = 'mastered';
    }

    // mastered -> verified(长期通过)
    // 阈值放宽:连续对 5 次 + 间隔 >= 21 天
    if (status === 'mastered' && consecutive_correct >= 5 && interval_days >= 21) {
      status = 'verified';
    }

    // mastered/verified 的间隔上限,避免过长
    if (status === 'mastered' && interval_days > 60) interval_days = 60;
    if (status === 'verified' && interval_days > 180) interval_days = 180;

    ease_factor = Math.min(2.8, ease_factor + 0.05);
  } else {
    // 答错:回到 learning,间隔重置
    repetitions = 0;
    consecutive_correct = 0;
    interval_days = 1;
    if (status === 'mastered' || status === 'verified') {
      status = 'learning';
    } else if (status === 'new') {
      status = 'learning';
    }
    ease_factor = Math.max(1.3, ease_factor - 0.2);
  }

  const next_review = addDays(todayStr(), interval_days);

  return {
    status,
    ease_factor: Math.round(ease_factor * 100) / 100,
    interval_days,
    repetitions,
    consecutive_correct,
    next_review,
    last_review: todayStr(),
    mastered_at: status === 'mastered' && !p.mastered_at ? todayStr() : p.mastered_at,
    total_seen: (p.total_seen || 0) + 1,
    total_correct: (p.total_correct || 0) + (correct ? 1 : 0),
  };
}

module.exports = { updateProgress, todayStr, addDays };
