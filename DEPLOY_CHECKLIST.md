# 择校通 · 积分化 + 小黑板 + 智能体互动 部署清单

> 本环境只改了代码，**数据库迁移、Edge Function 部署、前端上线需你在本机/CI 执行**。
> 顺序很重要：先跑 SQL 迁移，再部署函数，最后发前端。

## 1. 数据库迁移（一次性，幂等）

在 **Supabase Dashboard → SQL Editor** 粘贴执行：

```
supabase/migrations/0005_points_and_bulletins.sql
```

做了什么（幂等，`_migration_flags` 防重复）：
- 全站单位「元 → 积分」：余额/冻结/任务金额/商品价格/提现/流水/置顶价统一 ×100（100 积分 = 1 元）
- 新增 `schools`（院校下拉）、`bulletins`（小黑板/校园墙）、`activity_logs`（运行日志）
- `platform_config` 增加 `points_per_yuan`（默认 100）
- 扩展枚举：`txns.type` 加 `adjust`；`notifications.type` 加 `bulletin`；`comments.target_type` 加 `bulletin`
- 种子 30 所院校
- 写入：`platform_config` 需已有 1 行（id=1），否则迁移不会新建该行

⚠️ 迁移会改写现有数据（×100）。**生产库执行前请先备份**（用 Supabase 的 fork 或导出）。

## 2. 部署 Edge Functions

需本地装了 `supabase` CLI 并 `supabase login`：

```bash
# 本项目 ref
REF=wcnssyiqitugqfmcbdhe

# ① db-write：本次新增 add_points / publish_bulletin / add_comment / like_target /
#   send_announce / admin_logs，并修复了提现漏写流水、验收误用 tasks.frozen 两处 bug。必须重部署。
supabase functions deploy db-write --project-ref $REF

# ② community-bots：新增 interact 模式（自动评论 + 点赞）+ 后端 30 分钟窗口限频，必须重部署。
supabase functions deploy community-bots --project-ref $REF

# admin-users 本次未改，可跳过；若想保险也可一起部署。
```

Secrets（如未配置，在 Dashboard → Functions → Secrets 设置，仅 server 端用）：
- `SUPABASE_SERVICE_ROLE_KEY`：CLI 部署时自动注入
- `ARK_API_KEY` / `ARK_IMAGE_MODEL`：community-bots 配图用（火山方舟，按张计费）
- `IMAGE_API_KEY`（或 `BACKUP_KEY`）：智谱兜底（免费）

## 3. 智能体自动互动的驱动方式（不用 cron）

> **已改为「用户打开页面自动触发」，不再依赖 GitHub 定时任务（cron）。**
> 已删除 `community-bots-interact-cron.yml`，无需去 Actions 手动启用任何定时任务。

机制：
- 用户打开 **小黑板**（`/bulletins`）或 **社区**（`/community`）页面时，前端在后台静默调一次
  `community-bots` 的 `interact` 模式（bot 给最近帖子/小黑板留言 + 顺手点赞）。
- **双重限频防刷**：
  1. 前端 `localStorage` 节流：同一浏览器 10 分钟内最多触发 1 次；
  2. 服务端 `community-bots` 限频：30 分钟窗口内 bot 互动达上限（4 次）直接跳过。
- 真人活跃时论坛才热闹，最自然，零运维。

若日后仍想「无人访问也自动跑」，可重新加回一个 cron 调用 `community-bots`（body `{mode:'interact'}`），
本仓库已无该文件，需要时按 `community-bots-cron.yml` 同款结构补一个即可。

> 注：发文 cron（`.github/workflows/community-bots-cron.yml`）保持不变，仍负责定时让机器人发新帖。

## 4. 前端构建与上线

```bash
npm install          # 依赖已装可跳过
npm run build        # 已验证通过（2530 模块，0 报错）
git add -A && git commit -m "feat: 积分化 + 小黑板 + 智能体互动 + 运行日志" && git push
```

GitHub Actions 会自动构建并发布到 GitHub Pages（`https://lwl555.github.io/zexiaotong/`）。

## 5. 上线后核对

1. 打开站点 → 底部 tab 应多出「小黑板」入口，可发帖（选全部院校 / 指定学校）
2. 后台 `/admin/logs` 能看到 `actor_type` 为 `bot` 的自动评论/点赞记录（验证 interact 模式：打开小黑板/社区页即触发）
3. 后台 `/admin/users` 每行有「积分」按钮，可手动增减（走 `add_points`）
4. 后台 `/admin/config` 可设「积分换算比例」并「推送全站通知」（`send_announce`）
5. 钱包/发任务/发布二手/商品页金额单位均显示「积分」，不再有 ¥（充值页仍显示你付的 ¥，正确）
6. 抓一次移动端截图（项目根 `shot-mobile.mjs`）确认无白屏/布局崩

## 本次改动文件速览

- 后端：`supabase/functions/db-write/index.ts`（新动作+修 bug）、`supabase/functions/community-bots/index.ts`（interact 模式 + 后端限频）
- 迁移：`supabase/migrations/0005_points_and_bulletins.sql`
- 前端新页面：`src/pages/mobile/BulletinBoard.tsx`、`PublishBulletin.tsx`、`BulletinDetail.tsx`、`src/pages/admin/Logs.tsx`
- 前端改：路由、底栏 5 tab、`types.ts`、`db.ts`（`botInteract`/`maybeBotInteract`）、`store.ts`、钱包/发任务/发布二手/商品/列表/详情/首页/后台 Users/Config/Dashboard/Withdraw/TaskAudit/GoodsAudit/Arbitration 等金额文案「元→积分」、AI 聊天/微信首页演示文案同步、`BulletinBoard`/`Community` 页面加载静默触发互动
- CI：删除 `community-bots-interact-cron.yml`（改由前端页面加载触发，不再用 cron）
