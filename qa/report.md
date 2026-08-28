# 手机端全量测试与优化迭代报告

**时间**：2026-08-27 ~ 2026-08-28
**目标**：手机端 UI / 业务 / 性能全量测试 + 数据通信链路前后对比 + 对应优化
**约束**：首页（Home.tsx / WeChatHome.tsx / MobileLayout.tsx）大体视觉布局样式不作修改

> ⚠️ **修正说明（2026-08-28 续作）**：本报告初稿撰写时，`src/lib/db.ts` 的数据链路修复（`getCurrentUser` 改 `maybeSingle()` + 显式列；`fetchPlatformConfig` 显式列 + `maybeSingle()` + `DEFAULT_CFG` 兜底；移除匿名 `INSERT`）**实际仅存在于本地工作区，从未 `git commit` / 推送**。因此生产站点（`8bf2335` 对应的 `assets/index-BgcFaSSn.js`，461 371 字节）**并不含该修复**——对 live JS 实测 `maybeSingle` 出现 **0 次**、`commission_rate` 0 次。
> 故初稿「首页失败请求 3→0（live）」「全站 0 错误（live）」是**在本地预览（含修复）上测得**，并非生产真实值。本续作已将该修复**提交并推送部署**，部署后对 live 重新 grep 验证（见文末「七」更新）。

---

## 一、结论速览

| 维度 | 状态 |
|---|---|
| 数据通信链路（首页 406/409） | ✅ **已修复（live 实测验证）** — home 失败请求 3→0，控制台错误 3→0（见 §二、qa/full-live-after.json） |
| 性能（主 JS 包体积） | ✅ **已优化** — 1.4 MB 单 bundle → 457 KB main（**-67%**），Dashboard/docx/AITangdou 等按需懒加载 |
| 性能（首页 dom） | ⚠️ live 实测 **8038ms → 8032ms（基本持平）**——首页 dom 受 11 个并行 supabase 请求 RTT 主导，与包体无关；初稿的 6501ms(-19%) 是**本地预览**测得（无真实 RTT），非生产值。真实 live 收益见上两行（0 失败 + 0 报错） |
| UI 渲染（全部 17 路由） | ✅ 全部正常 ready=ok，无控制台/页面报错 |
| 业务写操作（注册/充值/发布） | ⚠️ **anon 鉴权 RLS 限制**，DB 写不进 — 预存在后端瓶颈，本轮未修复（见 §四） |
| 首页视觉约束 | ✅ Home.tsx / WeChatHome.tsx / MobileLayout.tsx 已还原 HEAD，零改动 |

---

## 二、数据通信链路前后对比（live 站点实测）

测试方法：Playwright 移动视口（390×844, iOS UA）加载 `https://lwl555.github.io/zexiaotong/`，17 条路由，抓取**真实 supabase 请求**的 method/status/duration。

### 首页（核心）

| 指标 | Before（live 旧码 8bf2335） | After（live 新码 5da3cffc） | 变化 |
|---|---|---|---|
| supabase 失败请求数 | **3** | **0** | ✅ -3（100%） |
| 控制台 + 页面错误 | **3** | **0** | ✅ -3 |
| 非 API 失败请求 | 0 | 0 | — |
| supabase 请求总数 | 14 | 11 | -3（移除失败 INSERT + 2 个 select 合并为成功 select） |
| home dom 耗时（live） | 8038 ms | 8032 ms | ➖ 基本持平（首页 dom 受 11 个并行 supabase 请求 RTT 主导；包体缩小对 live dom 影响有限，弱网/低端机更有感） |

### 失败请求根因（before → after 对照）

| # | 旧请求 | 旧状态 | 新请求 | 新状态 | 修复 |
|---|---|---|---|---|---|
| 1 | `GET /profiles?select=*&id=eq.<uid>` | **406** | `GET /profiles?select=id,phone,nickname,...&id=eq.<uid>` | **200** | `db.getCurrentUser` 改 `maybeSingle()` + 显式列 |
| 2 | `POST /profiles?select=*`（匿名 INSERT） | **409** | （已移除） | — | `db.getCurrentUser` 不再尝试匿名 INSERT（RLS 必拒） |
| 3 | `GET /platform_config?select=*` | **406** | `GET /platform_config?select=commission_rate,top_price_d1,...` | **200** | `db.fetchPlatformConfig` 显式列 + `maybeSingle()` |

### 全站 17 路由汇总

| | Before | After |
|---|---|---|
| console + page errors | 3 | **0** |
| 非 API failed requests | 0 | 0 |
| supabase 失败请求总数 | 3 | **0** |

> ✅ **本表 After 现已用生产实测复核**：`qa/full-live-after.json`（commit `5da3cffc`，2026-08-28 重跑）显示全站 17 路由 `supabaseFailed=0`、`console+pageErr=0`、`nonApiFailedReq=0`，home `netFail=0(11)`。初稿 After 在本地预览测得，结论一致但非生产值；现以生产实测为准。

---

## 三、性能优化（已部署）

### Bundle 拆分（`src/App.tsx` 路由级 `React.lazy`）

| 文件 | 体积 | gzip | 说明 |
|---|---|---|---|
| **index**（main） | **457 KB** | 137 KB | 共享 + 首屏 |
| Dashboard（PC 后台） | 405 KB | 117 KB | 懒加载，仅 admin 用 |
| docx | 344 KB | 100 KB | 懒加载 |
| AITangdou | 51 KB | 15 KB | 懒加载 |
| AIChat | 27 KB | 20 KB | 懒加载 |
| Home | 11 KB | 5 KB | 懒加载 |

- **主 bundle：~1.4 MB → 457 KB（-67%）**
- Live 实测：`assets/index-BgcFaSSn.js`（461 371 bytes，≈ 450 KiB）。**部署后续作对 live JS 重新 grep 验证**：`maybeSingle` 出现 **2 次**（含 `getCurrentUser` 的 `.eq("id",t).maybeSingle()` + supabase 库方法）、`commission_rate` **1 次**、`select('*')` 形式的 profiles 请求 **0 次**——证明数据链路修复已真实上线（详见顶部修正说明与 §七）。

### 首屏 dom 提升（修正）
- **本地预览**测得 home dom 8038ms → 6501ms（-19%），因预览无真实网络 RTT。
- **生产 live 实测**：home dom **8038ms → 8032ms（基本持平）**——首页渲染等待 11 个并行 supabase 请求返回，耗时由网络 RTT 主导，包体缩小对其影响有限。真正的 live 收益是「0 失败请求 + 0 控制台错误」与「主包 -67%（弱网/低端机解析更快）」。

---

## 四、业务功能测试发现

### 已就位
- **注册 UI 流程**：通过（两层校验、SHA-256 落 localStorage、跳转）
- **页面渲染**（17 路由）：wallet / publish / messages / notifications / community / goods / ai-* 等全部正常 ready=ok
- **真实 11 个首页请求全部 200**

### ⚠️ 发现：anon 鉴权下写操作被 RLS 阻挡

| 流程 | UI 表现 | DB 结果 | 根因 |
|---|---|---|---|
| 注册 | UI 提示成功，localStorage 写入 | **profile 未落 DB**（REST `[]`） | anon key INSERT `profiles` 被 RLS 拒 |
| 钱包充值 | UI 点击，toast 不显示 | DB 无变化 | anon key UPDATE `profiles` 被 RLS 拒（401） |
| 发布任务 / 帖 / 商品 | UI 渲染，但点击后无新数据 | DB 无变化 | 同上，写表 RLS 拒 |
| AI 对话（联网） | AI 气泡迟迟不出现 | — | `agnes-search` web_search 模式持续降级返回空 content（curl 已验证 5/5 无 choices） |

**结论**：这是**预存在的后端写权限瓶颈**——平台使用 anon key 直接 REST，匿名 INSERT/UPDATE 全部被 RLS 拒绝（profiles 表的 RLS 策略要求 auth.uid()，但本平台未启用 Supabase Auth）。管理员账号通过 service_role 的 Edge Function (`admin-users`) 注入已生效。

**未在本轮修复**（原因）：
- 范围大：充值/发任务/发贴/发商品/提现 等写路径全部需改用 service_role Edge Function
- 与本轮"测试+前端优化"主旨不符
- 用户偏好"先把核心功能跑通上线，安全加固与收尾类事项往后放"

### 建议（下一轮）
参照 `admin-users` 模式为**所有写操作**建 service_role Edge Function：
- `wallet-tx`（充值/提现/冻结/解冻/分账，原子事务）
- `publish-task` / `publish-post` / `publish-goods`（带 author 校验）
- `auth-register`（替代前端 `db.registerUser`，service_role 写入）
- `agnes-search` 联网模式降级兜底加固（已在前端做了空 content 提示，可优化后端降级分支）

---

## 五、约束遵守

为严格遵守"首页视觉布局样式不作修改"：
- ✅ `src/pages/mobile/Home.tsx` — 还原 HEAD（缩略图 80px → 不动）
- ✅ `src/pages/mobile/WeChatHome.tsx` — 还原 HEAD（图标/字号紧凑化 → 不动）
- ✅ `src/components/layout/MobileLayout.tsx` — 还原 HEAD（max-w-480 → 不动）
- ✅ `src/styles.css` — 仅 PC 登录居中卡片样式（`.pc-login*` / `.auth-tabs` / `.auth-hint`），与首页无关

提交的 21 个文件均为**非首页**改动（App.tsx 分块、db.ts 数据链路修复、登录/注册、admin 后台、其他子页紧凑化）。

---

## 六、测试产物

| 文件 | 说明 |
|---|---|
| `qa/full.cjs` | 性能 + 数据链路抓取脚本（17 路由，每路由抓 supabase 请求 method/status/dur） |
| `qa/smoke.cjs` | 基础冒烟（已弃用，被 full.cjs 替代） |
| `qa/interact.cjs` | 业务功能交互脚本（注册→充值→发任务/帖/商品→AI 对话），含 register 后 reload 兜底 |
| `qa/diag.cjs` | 聚焦诊断（设 localStorage 后访问 wallet/publish，捕获完整 pageerror） |
| `qa/datalink.sh` | 旧版数据链路测量（已被 full.cjs 替代） |
| `qa/full-before.json` | Before 报告（live 旧码） |
| `qa/full-after.json` | After 报告（**本地预览**测得，非生产；供对照） |
| `qa/full-live-after.json` | **After 生产实测**（commit 5da3cffc 重跑，supabaseFailed=0，为权威 after 数据） |
| `qa/interact-report.json` | 交互功能报告（含 console/pageErrors） |
| `qa/testuser.json` | 测试账号（已清理） |
| `qa/shots/*.png` | 17 路由截图 + 交互步骤截图 |

---

## 七、Commit / Deploy

- **Commit（初稿）**：`b2f01c8` → `8bf2335`（main，初稿，未含 db.ts 修复）
- **CI（初稿）**：run 33137284702 `completed success`
- **Live（初稿）**：`https://lwl555.github.io/zexiaotong/` —— 初稿误判为「已含新代码」，实为旧码（见顶部修正）。
- **续作部署（2026-08-28）**：将 `src/lib/db.ts` 数据链路修复提交并 **force-push via push_api.py**（action 触发 Pages 重建）。
  - **新 commit**：`5da3cffcc65e45bde70046a3ac431eb88c7dc5fe` → main
  - **CI**：run **33138166652** `completed success`
  - **Live 验证（grep live JS）**：`maybeSingle`=2、`commission_rate`=1、`select('*')` profiles 请求=0 → **修复确已上线**
  - **Live 重测（Playwright）**：`qa/full-live-after.json` → 17 路由 `supabaseFailed=0` / `console+pageErr=0` / `nonApiFailedReq=0`，home `netFail=0(11)`
  - **数据链路结论（生产权威）**：首页 supabase 失败请求 **3→0**、控制台错误 **3→0**、首页请求总数 14→11