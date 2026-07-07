# 每日英语 (Every Day Eng)

假期英语单词背诵应用,基于 SM-2 间隔重复算法,帮助孩子在假期(至 2026-09-01 开学)熟练背诵 688 个中考高频词。局域网多端访问,浏览器即用,零安装。

## 功能特性

- **词库**:688 个中考高频词,带音标、释义、词频
- **智能复习**:SM-2 间隔重复算法,自动调度复习时间
- **词根助记**:218 个词通过词根/词缀匹配生成助记
- **多端适配**:响应式设计,支持电视、平板、手机、电脑
- **离线发音**:浏览器原生 Web Speech API,无需音频文件
- **学习统计**:30 天答题分布、状态分布、薄弱词 Top 15
- **自由复习**:反向显示(中文→英文),随机顺序,不影响 SM-2 进度
- **零安装**:局域网内浏览器直接访问

## 技术栈

- **后端**:Node.js + Express(CommonJS)
- **数据库**:better-sqlite3(单文件 `data/vocab.db`,WAL 模式)
- **前端**:原生 HTML/CSS/JS(无框架)
- **发音**:Web Speech API
- **PDF 解析**:pdf-parse v2

## 快速开始

### 安装

```bash
npm install
```

### 导入词库

首次使用需从 PDF 提取并导入词库到数据库(幂等,可重跑):

```bash
npm run import
```

### 启动服务

```bash
npm start
# 或自定义端口
PORT=4000 npm start
# 或临时调整每日新词数
DAILY_NEW=10 npm start
```

启动后访问:
- 本机:http://localhost:3000
- 局域网:从启动日志读取 IP,如 http://10.10.7.162:3000

## 项目结构

```
every-day-eng/
├── AGENTS.md                              # AI agent 修改指南(详细规则)
├── package.json
├── doc/
│   ├── 中考英语688高频词大纲词频表.pdf       # 原始词库(只读)
│   └── words-raw.json                     # PDF 提取后的结构化词库
├── src/                                   # 后端源码
│   ├── db.js                              # SQLite 连接 + 建表
│   ├── srs.js                             # SM-2 间隔重复算法
│   ├── roots.js                           # 词根/词缀匹配,生成助记
│   └── server.js                          # Express 服务 + API 路由
├── public/                                # 前端静态资源
│   ├── index.html                         # 单页应用入口
│   ├── style.css                          # 响应式样式
│   └── app.js                             # 前端逻辑(学习/统计/设置)
├── scripts/                               # 一次性工具脚本
│   ├── parse-pdf.js                       # 调试:打印 PDF 文本
│   ├── extract-words.js                   # 提取 PDF → words-raw.json
│   ├── import-words.js                    # 导入词库到数据库(幂等)
│   ├── reset-progress.js                  # 清空学习进度(保留词库)
│   └── test-api.js                        # API 自测
└── data/
    └── vocab.db                           # SQLite 数据库(运行时生成)
```

## 常用命令

```bash
npm start                  # 启动服务(默认端口 3000)
npm run import             # 重新导入词库(幂等不丢进度)
npm run parse              # 解析 PDF 调试
node scripts/reset-progress.js   # 重置全部学习进度(保留词库)
node scripts/test-api.js        # API 自测
```

## API 概览

所有接口前缀 `/api`:

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/overview` | 首页概览:词库总数、各状态数量、今日数据 |
| GET | `/api/queue?mode=all\|new\|review` | 今日学习队列(新词按 freq 降序 + 到期复习词) |
| POST | `/api/answer` | 提交答题 `{word_id, action, result, mode}` |
| GET | `/api/stats?days=30` | 统计:每日答题分布、状态分布、薄弱词 |
| GET | `/api/words?status=all\|new\|learning\|mastered` | 词库列表(可按状态过滤) |
| GET | `/api/review-pool` | 自由复习词池(按掌握度升序) |
| GET | `/api/settings` | 读取设置 |
| POST | `/api/settings` | 保存设置 `{end_date, daily_new}` |

## SM-2 间隔重复算法

### 间隔计算(答对时)
- 第 1 次答对 → 1 天
- 第 2 次答对 → 3 天
- 之后 → `round(上次间隔 × ease_factor)`

### 状态流转
- `new` → `learning` → `mastered` → `verified`
- 连续答对 3 次 且间隔 ≥ 7 天 → `mastered`
- 连续答对 5 次 且间隔 ≥ 21 天 → `verified`
- `mastered` 间隔上限 60 天,`verified` 上限 180 天

### 答错处理
- 重复次数清零,间隔回到 1 天
- 状态退回 `learning`
- 难度系数下调 0.2(下限 1.3)

## 部署

### 局域网常驻

```bash
# 方式 1:nohup
nohup npm start > ~/vocab.log 2>&1 &

# 方式 2:pm2(推荐,开机自启)
npm i -g pm2
pm2 start src/server.js --name vocab
pm2 save
pm2 startup
```

### 备份

只需备份 `data/vocab.db` 一个文件(包含词库 + 全部进度)。WAL 模式下需连同 `vocab.db-wal`、`vocab.db-shm` 一起拷贝。

## 注意事项

- PDF 文件 `doc/中考英语688高频词大纲词频表.pdf` 是原始资料,只读勿改
- `data/` 目录不入库,含运行时数据库
- better-sqlite3 是原生模块,换机器需重新 `npm install`
- 每日新词数默认 5,可在设置页修改(写入 settings 表)
- 静态资源缓存已禁用,代码改动刷新即可生效

## 详细修改指南

若需修改本项目,请先阅读 [AGENTS.md](./AGENTS.md),其中包含完整的数据模型、算法规则、设计决策和修改注意事项。
