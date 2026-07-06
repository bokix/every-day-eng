// 前端逻辑
const $ = (id) => document.getElementById(id);
const api = (path, opt) => fetch('/api/' + path, opt).then(r => r.json());

let queue = [];        // 当前队列
let idx = 0;           // 当前卡片索引
let flipped = false;   // 是否已翻转(显示释义)
let sessionStats = { correct: 0, wrong: 0, total: 0 };
let freeReview = false; // 自由复习模式:不刷进度,可随时退出

// ---------- 自然拼读标注 ----------
const PHONICS = {
  VOWELS: 'aeiou',
  // 元音字母组合(发一个元音音)
  VOWEL_TEAMS: ['ai','ay','ea','ee','ei','ie','oa','oo','ou','ow','oy','ue','ui','aw','ew','oi','ar','er','ir','or','ur','air','ear','oor','ure','are','ire','ore','igh','eigh'],
  // 辅音字母组合(发一个辅音音;双辅音 pp/ll/ss 不算,它们要拆开)
  DIGRAPHS: ['tch','dge','sh','ch','th','wh','ph','ck','ng','nk','wr','kn','gn','qu']
};

// 拆分音节:基于 VCCV / VCV / 双辅音 / -le 结尾 / 静音 e 规则
function splitSyllables(word) {
  const w = word.toLowerCase();
  if (w.length <= 3) return [w];

  const V = 'aeiouy';
  // 找出所有元音组(连续元音视为一组)
  const groups = [];
  let i = 0;
  while (i < w.length) {
    if (V.includes(w[i])) {
      const start = i;
      while (i < w.length && V.includes(w[i])) i++;
      groups.push({ start, end: i - 1 });
    } else {
      i++;
    }
  }
  if (groups.length <= 1) return [w];

  // 判断词尾静音 e(但 -cle/-ble/-tle 等 -le 结尾的 e 发音)
  let numSyllables = groups.length;
  let silentE = false;
  if (w[w.length - 1] === 'e') {
    const lastG = groups[groups.length - 1];
    if (lastG.start === w.length - 1 && groups.length >= 2) {
      const beforeE = w[w.length - 2];
      const beforeBeforeE = w[w.length - 3];
      // -le 结尾且前面是辅音(table/apple/candle)→ e 发音,独立音节
      if (beforeE === 'l' && beforeBeforeE && !V.includes(beforeBeforeE)) {
        silentE = false;
      } else {
        silentE = true;
        numSyllables = groups.length - 1;
      }
    }
  }
  if (numSyllables <= 1) return [w];

  // 在相邻元音组之间切分
  const syllables = [];
  let lastCut = 0;
  const limit = silentE ? groups.length - 1 : groups.length;
  for (let g = 0; g < limit - 1; g++) {
    const cur = groups[g];
    const next = groups[g + 1];
    const cons = w.substring(cur.end + 1, next.start); // 两组之间的辅音串
    let cut;
    if (cons.length === 0) {
      cut = next.start;
    } else if (cons.length === 1) {
      // VCV:开音节,辅音归后一节(长元音)
      cut = cur.end + 1;
    } else if (cons.length === 2) {
      // VCCV:digraph(sh/ch 等)不拆,整体归后;否则中间切(含双辅音 pp/ll)
      cut = PHONICS.DIGRAPHS.includes(cons) ? next.start : cur.end + 2;
    } else {
      // 3+ 辅音:3 字母 digraph(tch/dge)不拆;否则第 1 个辅音归前(can/dle, chil/dren)
      cut = PHONICS.DIGRAPHS.includes(cons) ? next.start : cur.end + 2;
    }
    syllables.push(w.substring(lastCut, cut));
    lastCut = cut;
  }
  syllables.push(w.substring(lastCut));
  return syllables;
}

// 给单个音节上色:元音红、元音组合橙、辅音组合绿、单辅音蓝
function colorizeSyllable(syl) {
  let result = '';
  let i = 0;
  while (i < syl.length) {
    const three = syl.substr(i, 3).toLowerCase();
    const two = syl.substr(i, 2).toLowerCase();
    const one = syl[i].toLowerCase();
    const isLast = (i === syl.length - 1);
    if (three.length === 3 && PHONICS.VOWEL_TEAMS.includes(three)) {
      result += `<span class="ph-team">${syl.substr(i, 3)}</span>`;
      i += 3;
    } else if (PHONICS.VOWEL_TEAMS.includes(two)) {
      result += `<span class="ph-team">${syl.substr(i, 2)}</span>`;
      i += 2;
    } else if (PHONICS.DIGRAPHS.includes(three)) {
      result += `<span class="ph-digraph">${syl.substr(i, 3)}</span>`;
      i += 3;
    } else if (PHONICS.DIGRAPHS.includes(two)) {
      result += `<span class="ph-digraph">${syl.substr(i, 2)}</span>`;
      i += 2;
    } else if (PHONICS.VOWELS.includes(one) || (one === 'y' && isLast)) {
      // 词尾 y 作元音(happy 中的 y)
      result += `<span class="ph-vowel">${syl[i]}</span>`;
      i++;
    } else {
      result += `<span class="ph-cons">${syl[i]}</span>`;
      i++;
    }
  }
  return result;
}

// 生成带音节分隔与上色的 HTML
function phonicsMark(word) {
  if (!word) return '';
  return splitSyllables(word).map(colorizeSyllable).join('<span class="ph-syl">/</span>');
}

// ---------- 视图切换 ----------
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('view-' + t.dataset.view).classList.add('active');
    if (t.dataset.view === 'stats') loadStats();
    if (t.dataset.view === 'settings') loadSettings();
    if (t.dataset.view === 'study') loadOverview();
  });
});

// ---------- 概览加载 ----------
async function loadOverview() {
  const o = await api('overview');
  $('d-todayNew').textContent = o.todayNew;
  $('d-due').textContent = o.dueToday;
  $('d-streak').textContent = o.streak;
  $('d-daysLeft').textContent = o.daysLeft;

  const learned = o.mastered + o.verified;
  const total = o.total;
  $('progressText').textContent = `整体进度 ${learned} / ${total}(已掌握 ${learned},学习中 ${o.learning},待学 ${o.newLeft})`;
  $('progressFill').style.width = (learned / total * 100) + '%';

  $('overviewBar').innerHTML =
    `今日: 新词 <b>${o.todayNew}/${o.dailyNewTarget}</b> · ` +
    `答题 <b>${o.todayAnswered}</b> · ` +
    `正确率 <b>${o.todayAnswered ? Math.round(o.todayCorrect / o.todayAnswered * 100) : 0}%</b> · ` +
    `待复习 <b>${o.dueToday}</b>`;
}

// ---------- 开始学习 ----------
$('btnStart').addEventListener('click', startSession);

async function startSession() {
  const q = await api('queue');
  queue = [...q.newWords.map(w => ({ ...w, _act: 'study', _tag: '新词' })),
           ...q.reviewWords.map(w => ({ ...w, _act: 'review', _tag: '复习' }))];
  if (queue.length === 0) {
    if (confirm('今天的新任务已完成!\n是否进入"自由复习"(已学过的词,不刷进度,可随时退出)?')) {
      startFreeReview();
    }
    return;
  }
  freeReview = false;
  $('btnExit').classList.add('hidden');
  idx = 0;
  sessionStats = { correct: 0, wrong: 0, total: 0 };
  $('dashboard').classList.add('hidden');
  $('cardArea').classList.remove('hidden');
  $('sessionDone').classList.add('hidden');
  renderCard();
}

// ---------- 自由复习(纯练习,不刷进度) ----------
$('btnFreeReview').addEventListener('click', startFreeReview);

async function startFreeReview() {
  const r = await api('review-pool');
  if (!r.total) {
    alert('暂无可复习的词(还没学过任何词)。先去"开始今天的学习"吧!');
    return;
  }
  // 随机打乱,避免每次顺序相同
  queue = r.words.map(w => ({ ...w, _act: 'free', _tag: '自由复习' }))
    .sort(() => Math.random() - 0.5);
  freeReview = true;
  idx = 0;
  sessionStats = { correct: 0, wrong: 0, total: 0 };
  $('dashboard').classList.add('hidden');
  $('cardArea').classList.remove('hidden');
  $('sessionDone').classList.add('hidden');
  $('btnExit').classList.remove('hidden');
  renderCard();
}

// 退出自由复习,回首页
$('btnExit').addEventListener('click', () => {
  freeReview = false;
  queue = [];
  idx = 0;
  $('cardArea').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('btnExit').classList.add('hidden');
  loadOverview();
});

// ---------- 渲染卡片 ----------
function renderCard() {
  if (idx >= queue.length) { showDone(); return; }
  const w = queue[idx];
  flipped = false;

  $('cardTag').textContent = w._tag;
  $('cardTag').className = 'card-tag' + (w._act === 'review' ? ' review' : '');
  $('cardCount').textContent = `${idx + 1} / ${queue.length}`;
  $('cardWord').innerHTML = phonicsMark(w.word);
  $('cardWord').dataset.word = w.word;
  $('cardPhonetic').textContent = w.phonetic || '';
  $('cardMeaning').textContent = w.meaning || '';
  if (w.root_mnemonic) {
    $('cardMnemonic').textContent = w.root_mnemonic;
    $('cardMnemonic').classList.remove('hidden');
  } else {
    $('cardMnemonic').classList.add('hidden');
  }

  // 初始显示:新词 英→中(显示单词);复习词/自由复习 中→英(显示中文)
  const reverse = w._act === 'review' || w._act === 'free';
  if (reverse) {
    $('cardWord').classList.add('hidden');
    $('btnSpeak').classList.add('hidden');
    $('cardLegend').classList.add('hidden');
    $('cardPhonetic').classList.add('hidden');
    $('cardMeaning').classList.remove('hidden');
    $('cardMeaning').classList.add('meaning-big');
    $('btnFlip').textContent = '显示英文';
  } else {
    $('cardWord').classList.remove('hidden');
    $('btnSpeak').classList.remove('hidden');
    $('cardLegend').classList.remove('hidden');
    $('cardPhonetic').classList.add('hidden');
    $('cardMeaning').classList.add('hidden');
    $('cardMeaning').classList.remove('meaning-big');
    $('btnFlip').textContent = '显示释义';
    speak(w.word);
  }
  $('btnFlip').classList.remove('hidden');
  $('gradeActions').classList.add('hidden');
}

// ---------- 翻转 ----------
$('btnFlip').addEventListener('click', () => {
  flipped = true;
  const w = queue[idx];
  const reverse = w._act === 'review' || w._act === 'free';
  if (reverse) {
    // 中→英翻转:露出英文单词 + 拼读标注 + 音标,并发音
    $('cardWord').classList.remove('hidden');
    $('btnSpeak').classList.remove('hidden');
    $('cardLegend').classList.remove('hidden');
    $('cardPhonetic').classList.remove('hidden');
    speak(w.word);
  } else {
    // 英→中翻转:露出音标 + 释义
    $('cardPhonetic').classList.remove('hidden');
    $('cardMeaning').classList.remove('hidden');
  }
  $('btnFlip').classList.add('hidden');
  $('gradeActions').classList.remove('hidden');
});

// ---------- 评分 ----------
$('btnRight').addEventListener('click', () => grade(true));
$('btnWrong').addEventListener('click', () => grade(false));

async function grade(correct) {
  const w = queue[idx];
  sessionStats.total++;
  if (correct) sessionStats.correct++; else sessionStats.wrong++;

  // 自由复习模式:纯练习,不提交后端、不刷进度,答错也不再循环
  if (freeReview) {
    idx++;
    renderCard();
    return;
  }

  // 答错的词重新加到队尾,本次再背一次
  if (!correct) {
    queue.push({ ...w, _act: 'review', _tag: '复习(错)' });
  }

  await api('answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      word_id: w.id,
      action: w._act,
      result: correct ? 'correct' : 'wrong',
      mode: 'flashcard'
    })
  });

  idx++;
  renderCard();
}

// ---------- 发音 ----------
$('btnSpeak').addEventListener('click', () => {
  const w = $('cardWord').dataset.word || $('cardWord').textContent;
  speak(w);
});

function speak(word) {
  if (!('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

// ---------- 完成本轮 ----------
function showDone() {
  $('cardArea').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('sessionDone').classList.remove('hidden');
  const acc = sessionStats.total ? Math.round(sessionStats.correct / sessionStats.total * 100) : 0;
  $('doneInfo').innerHTML =
    `本轮共 ${sessionStats.total} 词<br>` +
    `正确 ${sessionStats.correct} · 错误 ${sessionStats.wrong}<br>` +
    `正确率 ${acc}%`;
  loadOverview();
}

$('btnBackHome').addEventListener('click', () => {
  $('sessionDone').classList.add('hidden');
});

// ---------- 统计页 ----------
async function loadStats() {
  const s = await api('stats?days=30');
  const map = {};
  s.statusDist.forEach(x => map[x.status] = x.c);
  $('statsGrid').innerHTML = [
    stat('词库总数', s.statusDist.reduce((a, b) => a + b.c, 0), 'all'),
    stat('已掌握', (map.mastered || 0) + (map.verified || 0), 'mastered'),
    stat('学习中', map.learning || 0, 'learning'),
    stat('待学习', map.new || 0, 'new'),
  ].join('');

  // 柱状图
  const max = Math.max(1, ...s.daily.map(d => d.total));
  $('chart').innerHTML = s.daily.map(d => {
    const h = Math.round(d.total / max * 100);
    const wrong = d.total - d.correct;
    const wrongH = Math.round(wrong / d.total * h) || 0;
    return `<div class="bar" style="height:${h}%" title="${d.date}: ${d.total}题,对${d.correct}错${wrong}">
      <div class="bar wrong" style="height:${wrongH}%"></div>
    </div>`;
  }).join('') || '<div style="color:#999;margin:auto">暂无数据</div>';

  // 薄弱词
  $('weakList').innerHTML = s.weakWords.map(w => {
    const rate = w.total_seen ? Math.round(w.total_correct / w.total_seen * 100) : 0;
    return `<div class="weak-item"><span class="w">${w.word}</span><span class="m">${w.meaning}</span><span class="r">${rate}% (${w.total_correct}/${w.total_seen})</span></div>`;
  }).join('') || '<div style="color:#999">暂无数据</div>';
}
function stat(lbl, num, status) {
  return `<div class="stat-cell clickable" data-status="${status}"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;
}

// ---------- 单词清单弹层 ----------
$('statsGrid').addEventListener('click', async (e) => {
  const cell = e.target.closest('.stat-cell.clickable');
  if (!cell) return;
  const status = cell.dataset.status;
  const r = await api(`words?status=${status}`);
  showWordList(cell.querySelector('.lbl').textContent, r);
});

function showWordList(title, r) {
  const items = r.words.map(w => {
    const acc = w.total_seen ? Math.round(w.total_correct / w.total_seen * 100) : 0;
    return `<li><span class="wl-word">${w.word}</span><span class="wl-meaning">${w.meaning || ''}</span><span class="wl-acc">${acc}%</span></li>`;
  }).join('') || '<li style="justify-content:center;color:#999">暂无单词</li>';
  $('wordListBody').innerHTML = `<h3>${title} <small>(${r.total})</small></h3><ul>${items}</ul>`;
  $('wordListModal').classList.remove('hidden');
}
$('wordListClose').addEventListener('click', () => $('wordListModal').classList.add('hidden'));
$('wordListModal').addEventListener('click', (e) => {
  if (e.target.id === 'wordListModal') $('wordListModal').classList.add('hidden');
});

// ---------- 设置页 ----------
async function loadSettings() {
  const s = await api('settings');
  $('setDailyNew').value = s.daily_new;
  $('setEndDate').value = s.end_date;
}
$('btnSaveSettings').addEventListener('click', async () => {
  await api('settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      daily_new: $('setDailyNew').value,
      end_date: $('setEndDate').value
    })
  });
  alert('已保存(每天新词数下次启动服务生效)');
});

// 初始
loadOverview();
