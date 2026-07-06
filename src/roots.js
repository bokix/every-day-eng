/**
 * 内置词根词缀表,用于本地匹配生成助记
 * 覆盖常见前缀/后缀/词根,匹配到的单词会生成简单助记说明
 */
const PREFIXES = [
  { pat: /^un/i, meaning: 'un- 表示否定/相反' },
  { pat: /^re/i, meaning: 're- 表示再/重新' },
  { pat: /^pre/i, meaning: 'pre- 表示在...之前/预先' },
  { pat: /^dis/i, meaning: 'dis- 表示否定/相反/分离' },
  { pat: /^mis/i, meaning: 'mis- 表示错误/坏' },
  { pat: /^over/i, meaning: 'over- 表示过度/在上' },
  { pat: /^under/i, meaning: 'under- 表示在...下/不足' },
  { pat: /^out/i, meaning: 'out- 表示超出/在外' },
  { pat: /^sub/i, meaning: 'sub- 表示在下面/次' },
  { pat: /^super/i, meaning: 'super- 表示超级/在上方' },
  { pat: /^trans/i, meaning: 'trans- 表示跨越/转换' },
  { pat: /^inter/i, meaning: 'inter- 表示在...之间' },
  { pat: /^fore/i, meaning: 'fore- 表示在前/预先' },
  { pat: /^en/i, meaning: 'en- 表示使...进入状态' },
  { pat: /^em/i, meaning: 'em- 表示使...进入状态' },
  { pat: /^in/i, meaning: 'in- 表示进入/否定' },
  { pat: /^im/i, meaning: 'im- 表示进入/否定' },
  { pat: /^il/i, meaning: 'il- 表示否定(用在 l 前)' },
  { pat: /^ir/i, meaning: 'ir- 表示否定(用在 r 前)' },
  { pat: /^non/i, meaning: 'non- 表示否定' },
  { pat: /^anti/i, meaning: 'anti- 表示反对/抗' },
  { pat: /^auto/i, meaning: 'auto- 表示自己/自动' },
  { pat: /^bio/i, meaning: 'bio- 表示生命/生物' },
  { pat: /^geo/i, meaning: 'geo- 表示地球/土地' },
  { pat: /^tele/i, meaning: 'tele- 表示远距离' },
  { pat: /^photo/i, meaning: 'photo- 表示光' },
  { pat: /^micro/i, meaning: 'micro- 表示微小' },
];

const SUFFIXES = [
  { pat: /tion$/i, meaning: '-tion 名词后缀,表示动作/状态' },
  { pat: /sion$/i, meaning: '-sion 名词后缀,表示动作/状态' },
  { pat: /ment$/i, meaning: '-ment 名词后缀,表示行为/结果' },
  { pat: /ness$/i, meaning: '-ness 名词后缀,表示状态/性质' },
  { pat: /able$/i, meaning: '-able 形容词后缀,表示可...的' },
  { pat: /ible$/i, meaning: '-ible 形容词后缀,表示可...的' },
  { pat: /ful$/i, meaning: '-ful 形容词后缀,表示充满...的' },
  { pat: /less$/i, meaning: '-less 形容词后缀,表示无...的' },
  { pat: /ous$/i, meaning: '-ous 形容词后缀,表示具有...的' },
  { pat: /al$/i, meaning: '-al 形容词后缀,表示与...有关的' },
  { pat: /ic$/i, meaning: '-ic 形容词后缀,表示...的' },
  { pat: /ive$/i, meaning: '-ive 形容词后缀,表示有...倾向的' },
  { pat: /ly$/i, meaning: '-ly 副词后缀,表示以...方式' },
  { pat: /er$/i, meaning: '-er 表示做...的人/物' },
  { pat: /or$/i, meaning: '-or 表示做...的人/物' },
  { pat: /ist$/i, meaning: '-ist 表示做...的人' },
  { pat: /ism$/i, meaning: '-ism 表示主义/学说' },
  { pat: /ize$/i, meaning: '-ize 动词后缀,表示使...化' },
  { pat: /ise$/i, meaning: '-ise 动词后缀,表示使...化' },
  { pat: /ify$/i, meaning: '-ify 动词后缀,表示使...' },
  { pat: /en$/i, meaning: '-en 动词/形容词后缀,表示使.../由...制成' },
  { pat: /ing$/i, meaning: '-ing 动名词/现在分词后缀' },
  { pat: /ed$/i, meaning: '-ed 过去式/过去分词后缀' },
  { pat: /ly$/i, meaning: '-ly 副词后缀' },
];

const ROOTS = [
  { pat: /spect/i, meaning: '词根 -spect- 表示看' },
  { pat: /vis/i, meaning: '词根 -vis- 表示看' },
  { pat: /vid/i, meaning: '词根 -vid- 表示看' },
  { pat: /dict/i, meaning: '词根 -dict- 表示说' },
  { pat: /scrip/i, meaning: '词根 -scrip- 表示写' },
  { pat: /port/i, meaning: '词根 -port- 表示搬运/携带' },
  { pat: /tract/i, meaning: '词根 -tract- 表示拉/拖' },
  { pat: /ject/i, meaning: '词根 -ject- 表示投/扔' },
  { pat: /duct/i, meaning: '词根 -duct- 表示引导' },
  { pat: /ceed|cess/i, meaning: '词根 -ceed/cess- 表示走/让步' },
  { pat: /pend/i, meaning: '词根 -pend- 表示悬挂/称量' },
  { pat: /ject/i, meaning: '词根 -ject- 表示投掷' },
  { pat: /vert/i, meaning: '词根 -vert- 表示转' },
  { pat: /form/i, meaning: '词根 -form- 表示形状' },
  { pat: /struct/i, meaning: '词根 -struct- 表示建造' },
  { pat: /stant|stan/i, meaning: '词根 -stant- 表示站立' },
  { pat: /tain/i, meaning: '词根 -tain- 表示保持/拿' },
  { pat: /gest/i, meaning: '词根 -gest- 表示带来/承载' },
  { pat: /pose|posit/i, meaning: '词根 -pose- 表示放置' },
  { pat: /mit|miss/i, meaning: '词根 -mit/miss- 表示送/发' },
  { pat: /ceive|cept/i, meaning: '词根 -ceive/cept- 表示拿/抓' },
  { pat: /fact|fect/i, meaning: '词根 -fact/fect- 表示做' },
  { pat: /rupt/i, meaning: '词根 -rupt- 表示断裂' },
  { pat: /clud|clus/i, meaning: '词根 -clud/clus- 表示关闭' },
  { pat: /count/i, meaning: '词根 -count- 表示计算' },
  { pat: /sign/i, meaning: '词根 -sign- 表示标记' },
  { pat: /memor/i, meaning: '词根 -memor- 表示记忆' },
  { pat: /popul/i, meaning: '词根 -popul- 表示人/人民' },
  { pat: / natur/i, meaning: '词根 -natur- 表示出生/自然' },
  { pat: /beaut/i, meaning: '词根 -beaut- 表示美' },
  { pat: /import/i, meaning: '组合:im(进入)+port(搬运)=重要/输入' },
];

/**
 * 为单词生成词根助记
 * @param {string} word
 * @returns {string|null}
 */
function buildMnemonic(word) {
  if (!word || word.length < 4) return null;
  const hits = [];
  for (const r of ROOTS) {
    if (r.pat.test(word)) { hits.push(r.meaning); break; }
  }
  for (const p of PREFIXES) {
    if (p.pat.test(word) && word.length > p.pat.toString().length + 2) {
      hits.push(p.meaning); break;
    }
  }
  for (const s of SUFFIXES) {
    if (s.pat.test(word) && word.length > 4) {
      hits.push(s.meaning); break;
    }
  }
  return hits.length ? hits.join(' | ') : null;
}

module.exports = { buildMnemonic };
