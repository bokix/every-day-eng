const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'doc', '中考英语688高频词大纲词频表.pdf');

(async () => {
  const dataBuffer = fs.readFileSync(pdfPath);
  const data = new Uint8Array(dataBuffer);

  const parser = new PDFParse({ data });
  const result = await parser.getText();
  await parser.destroy();

  console.log('=== PDF 文本结果 ===');
  console.log('总文本长度:', result.text.length);
  if (result.pages) {
    console.log('页数:', result.pages.length);
    result.pages.forEach((p, i) => {
      console.log(`第 ${i + 1} 页文本长度: ${p.text ? p.text.length : 0}`);
    });
  }

  console.log('\n=== 前 3000 字符 ===\n');
  console.log(result.text.slice(0, 3000));
  console.log('\n=== 中间 3000 字符 (从 50% 处) ===\n');
  const mid = Math.floor(result.text.length / 2);
  console.log(result.text.slice(mid, mid + 3000));
  console.log('\n=== 末尾 2000 字符 ===\n');
  console.log(result.text.slice(-2000));
})();
