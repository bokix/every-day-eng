# AGENTS.md

本项目是一个局域网英语单词背诵应用,供假期孩子使用。任何 AI agent 在修改本项目前,请先阅读本文档。

## 项目目标

- 背诵 `doc/中考英语688高频词大纲词频表.pdf` 中的 688 个高频词
- 假期使用(至 2026-09-01 开学),背完后进入复习/测试模式
- 局域网多端访问(平板、手机、电视、电脑),浏览器即用,零安装
- 单用户场景,无需登录

## 技术栈

- **后端**:Node.js + Express(CommonJS)
- **数据库**:better-sqlite3(单文件 `data/vocab.db`,WAL 模式)
- **前端**:原生 HTML/CSS/JS(无框架),响应式适配多端
- **发音**:浏览器原生 Web Speech API(无需音频文件)
- **PDF 解析**:pdf-parse v2(注意:v2 用 `new PDFParse({data})` + `getText()`,不是 v1 的直接调用)

## 项目结构

```
every-day-eng/
├── AGENTS.md                              # 本文件
├── package.json
├── doc/
│   ├── 中考英语688高频词大纲词频表.pdf       # 原始词库(只读,勿改)
│   └── words-raw.json                     # PDF 提取后的结构化词库
├── src/                                   # 后端源码
│   ├── db.js                              # SQLite 连接 + 建表
│   ├── srs.js                             # SM-2 间隔重复算法 + 掌握度判定
│   ├── roots.js                           # 词根/词缀匹配,生成助记
│   └── server.js                          # Express 服务 + 全部 API 路由
├── public/                                # 前端静态资源
│   ├── index.html                         # 单页应用入口
│   ├── style.css                          # 响应式样式(含电视/平板/手机断点)
│   └── app.js                             # 前端逻辑(学习/统计/设置三视图)
├── scripts/                               # 一次性工具脚本
│   ├── parse-pdf.js                       # 调试用:打印 PDF 文本
│   ├── extract-words.js                   # 提取 PDF → words-raw.json
│   ├── import-words.js                    # 导入词库到数据库(幂等,可重跑)
│   ├── reset-progress.js                  # 清空学习进度(保留词库)
│   └── test-api.js                        # API 自测
└── data/
    └── vocab.db                           # SQLite 数据库(运行时生成,需备份)
```

## 数据模型

四张表,定义在 `src/db.js`:

- **words**:词库(688 条)。字段:`word, phonetic, meaning, freq, root_mnemonic`
- **progress**:每个词的学习进度(688 条,与 words 一一对应)。核心字段:
  - `status`: `new` → `learning` → `mastered` → `verified`
  - `ease_factor`(难度系数,初始 2.5)、`interval_days`(下次间隔)、`repetitions`、`consecutive_correct`
  - `next_review`(到期日期)、`last_review`、`mastered_at`
  - `total_seen`、`total_correct`(累计统计)
- **study_log**:每次答题流水。字段:`word_id, date, session(morning/noon/evening), action(study/review), result(correct/wrong), mode(flashcard/...)`
- **settings**:键值对配置。当前有 `end_date`(假期截止,默认 2026-09-01)、`daily_new`(每天新词数,默认 50)

## 核心算法:SM-2 间隔重复

实现在 `src/srs.js` 的 `updateProgress(p, correct)`,**修改前务必理解以下规则**:

### 间隔计算(答对时)
- 第 1 次答对 → 间隔 1 天
- 第 2 次答对 → 间隔 3 天
- 之后 → `interval = round(上次间隔 × ease_factor)`

### 状态流转
- `new` / `learning`:连续答对 **3 次** 且间隔 ≥ 7 天 → 升级为 `mastered`
- `mastered`:连续答对 **5 次** 且间隔 ≥ 21 天 → 升级为 `verified`(基本不再复习)
- `mastered` 间隔上限 60 天,`verified` 上限 180 天

### 答错处理
- `repetitions` 和 `consecutive_correct` 清零,间隔回到 1 天
- 状态退回 `learning`(`mastered`/`verified` 也退回)
- `ease_factor` 下调 0.2(下限 1.3)

### 答对处理
- `ease_factor` 上调 0.05(上限 2.8)

## API 路由

全部在 `src/server.js`,前缀 `/api`:

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/overview` | 首页概览:词库总数、各状态数量、今日数据、连续天数、距开学天数 |
| GET | `/api/queue?mode=all\|new\|review` | 今日学习队列:新词(按 freq 降序)+ 到期复习词 |
| POST | `/api/answer` | 提交答题。body:`{word_id, action, result, mode}` |
| GET | `/api/stats?days=30` | 统计:每日答题分布、状态分布、薄弱词 Top 15 |
| GET | `/api/settings` | 读取设置 |
| POST | `/api/settings` | 保存设置。body:`{end_date, daily_new}` |

**关键约束**:
- 每天新词数受 `DAILY_NEW` 环境变量控制(默认 50),也受 settings 表 `daily_new` 影响
- 新词按 `freq DESC` 取(高频词优先)
- 复习词按 `next_review ASC, consecutive_correct ASC` 排序(最该复习的先来)
- 答错的词在前端会被重新加到队尾,当轮再背一次

## 前端结构

单页应用,三个视图(学习 / 统计 / 设置),通过顶部 tab 切换:

- **学习视图**:仪表盘(概览数据 + 整体进度条)→ 点击"开始今天的学习" → 卡片轮播
- **卡片流程**:显示单词 → 点击"显示释义"翻转 → 点"记得"/"不记得"评分 → 下一张
- **完成态**:本轮统计(总数/正确/错误/正确率)

**响应式断点**(`public/style.css`):
- `≥1200px`:电视端,字号最大(word 72px)
- `768-1199px`:平板
- `≤480px`:手机,2 列仪表盘

## 设计决策(请勿轻易改动)

1. **没有"斩"按钮**:孩子可能乱点。改用 SM-2 自动判定掌握度,只有"记得/不记得"两个诚实按钮
2. **单用户**:无需登录、无多用户隔离,简化实现
3. **SQLite 而非 MySQL**:单文件,零配置,备份直接拷文件
4. **原生 JS 而非框架**:依赖少,启动快,适合局域网小工具
5. **发音用 Web Speech API**:零音频文件,浏览器原生支持

## 常用命令

```bash
# 启动服务(开发)
npm start
# 或:node src/server.js
# 端口默认 3000,可用 PORT=4000 自定义

# 重新导入词库(修改 PDF 后,幂等不丢进度)
npm run import

# 解析 PDF 调试
npm run parse

# 重置全部学习进度(保留词库)
node scripts/reset-progress.js

# API 自测
node scripts/test-api.js
```

## 修改指南

### 添加新 API
在 `src/server.js` 末尾 `app.listen` 之前添加路由。数据库操作用 `better-sqlite3` 的 prepared statement(同步 API)。

### 修改 SM-2 参数
改 `src/srs.js` 的 `updateProgress`。注意:
- 掌握阈值(5 次/30 天、9 次/90 天)是经验值,改动会影响整体进度
- `ease_factor` 边界(1.3 下限、2.8 上限)不要轻易放宽

### 添加词根助记
编辑 `src/roots.js` 的 `ROOTS` / `PREFIXES` / `SUFFIXES` 数组,然后重新运行 `npm run import` 会重新生成 `root_mnemonic` 字段(不会影响学习进度)。

### 修改前端样式
编辑 `public/style.css`。三个断点已分好,注意电视端字号要大(2 米观看距离)。

### 修改每日新词数
- 临时:启动时 `DAILY_NEW=30 npm start`
- 永久:设置页保存(写入 settings 表),或改 `src/server.js` 第 7 行默认值

## 部署

### 局域网常驻
```bash
# 方式 1:nohup
nohup npm start > ~/vocab.log 2>&1 &

# 方式 2:pm2(推荐)
npm i -g pm2
pm2 start src/server.js --name vocab
pm2 save
pm2 startup  # 开机自启
```

### 访问地址
- 本机:http://localhost:3000
- 局域网:从服务启动日志读取 IP,如 http://10.10.7.162:3000

### 备份
只需备份 `data/vocab.db` 一个文件(包含词库 + 全部进度)。

## 注意事项

- **PDF 文件只读**:`doc/中考英语688高频词大纲词频表.pdf` 是原始资料,不要修改
- **`data/` 目录不入库**:含运行时数据库,已在 .gitignore(如添加)
- **better-sqlite3 是原生模块**:换机器需重新 `npm install`,可能需要 Xcode 命令行工具
- **WAL 模式**:数据库会生成 `vocab.db-wal`、`vocab.db-shm` 文件,备份时一起拷
