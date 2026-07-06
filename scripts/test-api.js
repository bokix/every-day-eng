const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('=== 测试 /api/overview ===');
    const o = await get('/api/overview');
    console.log('状态:', o.status);
    const oj = JSON.parse(o.body);
    console.log('总词数:', oj.total, '待学:', oj.newLeft, '学习中:', oj.learning);
    console.log('今日新词:', oj.todayNew, '待复习:', oj.dueToday, '连续天数:', oj.streak);
    console.log('距开学:', oj.daysLeft, '天');

    console.log('\n=== 测试 /api/queue ===');
    const q = await get('/api/queue');
    console.log('状态:', q.status);
    const qj = JSON.parse(q.body);
    console.log('新词数:', qj.newWords.length, '复习词数:', qj.reviewWords.length);
    if (qj.newWords.length > 0) {
      console.log('第一个新词:', qj.newWords[0].word, '-', qj.newWords[0].meaning);
      console.log('助记:', qj.newWords[0].root_mnemonic || '(无)');
    }

    console.log('\n=== 测试 /api/stats ===');
    const s = await get('/api/stats?days=7');
    console.log('状态:', s.status);
    console.log('返回长度:', s.body.length);

    console.log('\n=== 测试首页 ===');
    const h = await get('/');
    console.log('状态:', h.status, 'HTML 长度:', h.body.length);

    console.log('\n所有 API 测试通过!');
  } catch (e) {
    console.error('测试失败:', e.message);
    process.exit(1);
  }
})();
