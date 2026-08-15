# 择校通 · 说大实话的择校/求职/搞钱工具集

用 **React + Vite + TypeScript** 前端 + **Supabase Edge Function (`agnes-proxy`)** 后端 + **DeepSeek `deepseek-v4-flash`** 模型，克隆自「妙搭」上的择校通，界面重做为高级简约风。

## 功能
- **AI百事通**：查院校 / 按城市找工作 / 查公司，联网搜索真实信息，直说优缺点（`web_search` 开）
- **实时资讯台**：填分数/位次/意向，按「冲稳保」推荐院校与专业
- **文档工坊**：AI 生成院校分析报告 / 简历 / 避雷清单，一键导出 Word
- **避雷清单**：公共看板，记录学校/公司真实坑，导出 Word
- **搞钱项目**：公共看板，兼职/副业/创业/悬赏项目聚合

## 本地开发
```bash
cp .env.example .env.local
# 填好 VITE_AGNES_BASE（agnes-proxy 地址）与 VITE_SUPABASE_*（见 .env.example）
npm install
npm run dev
```
开发态前端请求 `/api/agnes`，由 `vite.config.ts` 的 proxy 在服务端注入上游 key（key 不进 bundle）。

## 部署
### 1. 后端（agnes-proxy）
```bash
supabase functions deploy agnes-proxy --project-ref wcnssyiqitugqfmcbdhe
supabase secrets set DEEPSEEK_KEY=你的DeepSeekKey   --project-ref wcnssyiqitugqfmcbdhe
# 可选：配了就用 Serper 做真·搜索；不配则 DuckDuckGo 兜底
supabase secrets set SERPER_API_KEY=xxx              --project-ref wcnssyiqitugqfmcbdhe
```
> 你已把 agnes-proxy 改接 DeepSeek，本仓库 `supabase/functions/agnes-proxy/index.ts` 是带「联网搜索」的增强版，redeploy 即可。

### 2. 数据库（Supabase 表 + RLS）
在 Supabase 后台 SQL Editor 粘贴运行 `supabase/migrations/0001_init.sql`。
（RLS 目前对匿名开放，适合公共看板；收紧方法见文件内注释。）

### 3. 前端（GitHub Pages，沿用你之前方式）
- 仓库 Settings → Pages → Build from GitHub Actions。
- 在仓库 Secrets 配置：`VITE_AGNES_BASE` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON`。
- 推到 `main` 分支即自动构建部署；站点在 `https://<你>/<仓库>/zexiaotong/`（`base` 已设为 `/zexiaotong/`）。

## 目录
```
src/
  lib/agnes.ts        OpenAI 兼容代理客户端（VITE_AGNES_BASE + anon 鉴权）
  lib/supabase.ts     Supabase 客户端
  lib/prompts.ts      各功能系统提示词
  lib/docx.ts         Word 导出
  components/         Layout / AIChat / Report
  pages/              Home / AISearch / AITutor / DocWorkshop / Warnings / Money
supabase/
  functions/agnes-proxy/index.ts   带联网搜索的 Edge Function
  migrations/0001_init.sql         表 + RLS
```

## 安全约定
- 上游（DeepSeek）key 只在 Edge Function 的 Deno secret，前端永不持有。
- 前端只带 Supabase 匿名 key 鉴权「能否调用函数」。
- 匿名 key 明文在前端属常规，前提是数据库开了 RLS（本仓库已配）。
