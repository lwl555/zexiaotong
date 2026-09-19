-- 0012_create_reports.sql
-- 背景：帖子详情页的「举报」原本是假按钮（点击只返回首页），举报数据无处落地。
-- 本迁移建举报表，让举报成为真实功能：用户可提交，管理员可在后台处理。
--
-- 读写策略：
--   - 写入走 Edge `db-write` 的 insert（表在 INSERT_ALLOWED 白名单，owner=reporter_id 校验）。
--   - 读取走 Edge `db-write` 的 `list_reports` 动作（service_role，仅管理员）。
--   - 因此**不开放 anon 读策略**，避免举报内容（含举报人、被举报对象）被匿名读取。

create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  target_type   text not null,                      -- post | goods | task | comment | user
  target_id     text not null,                      -- 被举报对象 id
  target_title  text,                               -- 冗余存标题，便于后台列表直接展示
  reason        text not null,                      -- 举报原因（预设枚举文案）
  detail        text,                               -- 补充说明
  reporter_id   uuid,
  reporter_name text,
  status        text not null default 'pending',    -- pending | handled | rejected
  created_at    timestamptz not null default now()
);

create index if not exists reports_created_idx on reports (created_at desc);
create index if not exists reports_status_idx  on reports (status);

alter table reports enable row level security;
-- 刻意不建任何 anon 策略：读必须经 Edge 的管理员校验，写必须经 Edge 的 owner 校验。
