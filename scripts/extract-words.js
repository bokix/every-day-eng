const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'doc', '中考英语688高频词大纲词频表.pdf');
const outPath = path.join(__dirname, '..', 'doc', 'words-raw.json');

(async () => {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(dataBuffer);
  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();

  const lines = result.text.split('\n');
  const words = [];
  let pendingFrag = null; // 处理释义跨行的情况

  // 跳过页眉/页脚/页码行
  const isNoise = (l) =>
    /^Word\s+List\s+\d+$/i.test(l) ||
    /^考频/.test(l) ||
    /^--\s*\d+\s+of\s+\d+\s*--$/.test(l.trim()) ||
    /^\d+$/.test(l.trim()); // 单独的页码数字

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (isNoise(line)) {
      pendingFrag = null;
      continue;
    }

    // 按多个空格/制表符拆分
    const parts = line.split(/\t+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
    // 期望格式: [考频, 单词, 音标, 词义...]
    // 但有时列分隔不规整,需要更稳健的处理
    // 先尝试:第一个是纯数字(考频),第二个是单词,第三个是[音标],剩下是词义
    const freqMatch = parts[0] && /^\d+$/.test(parts[0]);
    if (freqMatch && parts.length >= 3) {
      const freq = parseInt(parts[0], 10);
      const word = parts[1];
      // 找音标(以 [ 开头)
      let phoneticIdx = parts.findIndex((p, idx) => idx >= 2 && /^\[.*\]$/.test(p));
      let phonetic = '';
      let meaningParts = [];
      if (phoneticIdx >= 0) {
        phonetic = parts[phoneticIdx];
        meaningParts = parts.slice(phoneticIdx + 1);
      } else {
        // 没有音标,从第3个开始都是词义
        meaningParts = parts.slice(2);
      }
      const meaning = meaningParts.join(' ').trim();
      if (word) {
        // 如果有 pendingFrag(上一条的释义残片),拼到上一条
        if (pendingFrag && words.length > 0) {
          words[words.length - 1].meaning += ' ' + pendingFrag;
          pendingFrag = null;
        }
        words.push({ freq, word, phonetic, meaning });
      }
    } else {
      // 当前行不是标准格式,可能是上一条释义的跨行残片
      // 只有在没有数字开头时,当作释义残片
      pendingFrag = line.trim();
    }
  }

  // 输出
  console.log('提取到单词数:', words.length);
  console.log('前 5 条:');
  console.log(JSON.stringify(words.slice(0, 5), null, 2));
  console.log('后 5 条:');
  console.log(JSON.stringify(words.slice(-5), null, 2));

  // 统计音标缺失
  const noPhonetic = words.filter((w) => !w.phonetic);
  console.log('\n音标缺失数量:', noPhonetic.length);
  if (noPhonetic.length > 0) {
    console.log('音标缺失示例:', noPhonetic.slice(0, 5).map((w) => w.word));
  }

  // 检查释义是否为空
  const noMeaning = words.filter((w) => !w.meaning);
  console.log('释义缺失数量:', noMeaning.length);

  fs.writeFileSync(outPath, JSON.stringify(words, null, 2), 'utf-8');
  console.log('\n原始数据已写入:', outPath);
})();
