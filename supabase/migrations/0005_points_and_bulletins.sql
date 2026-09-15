-- ============================================================
-- 0005 积分体系 + 小黑板(校园墙) + 运行日志
-- ============================================================
-- 业务变更说明：
--   1) 全站交易单位由「元」转为「积分」：100 积分 = 1 元（可提现）。
--      历史存量数据（余额/冻结/任务金额/商品价格/提现/流水/置顶价）统一 ×100 变为积分。
--   2) 新增 schools（预设院校，小黑板下拉）、bulletins（小黑板/校园墙）、activity_logs（运行日志）。
--   3) txns.type / notifications.type 扩展；comments.target_type 扩展支持 'bulletin'。
--   4) platform_config 增加 points_per_yuan（默认 100）。
--
-- 幂等：用 _migration_flags 表防止重复执行导致数据二次放大。
-- 执行方式：Supabase Dashboard → SQL Editor 粘贴执行；或 supabase db push。
-- ============================================================

create table if not exists _migration_flags (name text primary key, done_at timestamptz default now());

do $$
begin
  if exists (select 1 from _migration_flags where name = '0005_points') then
    return;
  end if;

  -- ── 1) 单位转换：元 → 积分（×100）──
  update profiles set balance = coalesce(balance, 0) * 100, frozen = coalesce(frozen, 0) * 100;
  update tasks set amount = coalesce(amount, 0) * 100;
  update goods set price = coalesce(price, 0) * 100;
  update withdrawals set amount = coalesce(amount, 0) * 100;
  update txns set amount = coalesce(amount, 0) * 100, balance_after = coalesce(balance_after, 0) * 100;
  update platform_config set
    top_price_d1 = coalesce(top_price_d1, 0) * 100,
    top_price_d3 = coalesce(top_price_d3, 0) * 100,
    top_price_d7 = coalesce(top_price_d7, 0) * 100;

  insert into _migration_flags(name) values ('0005_points');
end $$;

-- ── 2) platform_config 增加积分换算比例 ──
alter table platform_config add column if not exists points_per_yuan numeric(10,2) not null default 100;
update platform_config set points_per_yuan = 100 where points_per_yuan is null or points_per_yuan = 0;

-- ── 3) 院校表（小黑板预设学校下拉）──
create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- ── 4) 小黑板 / 校园墙 ──
create table if not exists bulletins (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references schools(id) on delete set null,
  school_name text not null default '全部院校',
  author_id uuid references profiles(id) on delete cascade,
  author_name text not null,
  author_avatar text default '',
  content text not null,
  images text[] default '{}',
  is_all_schools boolean default false,
  likes int default 0,
  comments int default 0,
  status text default 'on' check (status in ('on', 'off', 'removed')),
  created_at timestamptz default now()
);

-- ── 5) 运行日志（智能体 / 管理员 / 用户 / 系统）──
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'admin', 'bot', 'system')),
  actor_id text default '',
  actor_name text default '',
  action text not null,
  target_type text default '',
  target_id text default '',
  detail text default '',
  created_at timestamptz default now()
);

-- ── 6) 扩展枚举 ──
alter table txns drop constraint if exists txns_type_check;
alter table txns add constraint txns_type_check check (
  type in ('recharge', 'income', 'pay', 'withdraw', 'commission', 'refund', 'freeze', 'unfreeze', 'adjust')
);

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check check (
  type in ('task_status', 'task_taken', 'task_review', 'arbitration', 'comment', 'message', 'announce', 'bulletin')
);

alter table comments drop constraint if exists comments_target_type_check;
alter table comments add constraint comments_target_type_check check (
  target_type in ('task', 'post', 'goods', 'bulletin')
);

-- ============================================================
-- 索引
-- ============================================================
create index if not exists idx_schools_name on schools(name);
create index if not exists idx_bulletins_school on bulletins(school_id);
create index if not exists idx_bulletins_all on bulletins(is_all_schools);
create index if not exists idx_bulletins_status on bulletins(status);
create index if not exists idx_bulletins_created on bulletins(created_at desc);
create index if not exists idx_activity_actor on activity_logs(actor_type);
create index if not exists idx_activity_action on activity_logs(action);
create index if not exists idx_activity_created on activity_logs(created_at desc);

-- ============================================================
-- 启用 RLS
-- ============================================================
alter table schools enable row level security;
alter table bulletins enable row level security;
alter table activity_logs enable row level security;

-- ── schools：所有人可读，管理员可写 ──
drop policy if exists "schools_select" on schools;
create policy "schools_select" on schools for select using (true);
drop policy if exists "schools_admin" on schools;
create policy "schools_admin" on schools for all using (auth.role() = 'admin');

-- ── bulletins：所有人可读、本人可写、管理员可管 ──
drop policy if exists "bulletins_select" on bulletins;
create policy "bulletins_select" on bulletins for select using (true);
drop policy if exists "bulletins_insert" on bulletins;
create policy "bulletins_insert" on bulletins for insert with check (auth.uid()::text = author_id::text);
drop policy if exists "bulletins_update" on bulletins;
create policy "bulletins_update" on bulletins for update using (
  auth.uid()::text = author_id::text or auth.role() = 'admin'
);
drop policy if exists "bulletins_admin" on bulletins;
create policy "bulletins_admin" on bulletins for all using (auth.role() = 'admin');

-- ── activity_logs：仅管理员可读（运行日志属后台视角）──
drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select using (auth.role() = 'admin');
drop policy if exists "activity_logs_insert" on activity_logs;
create policy "activity_logs_insert" on activity_logs for insert with check (true);

-- ============================================================
-- 种子院校（预设下拉；用户发布小黑板时从中选择「指定学校」）
-- ============================================================
insert into schools (name) values
  ('北京大学'), ('清华大学'), ('复旦大学'), ('上海交通大学'), ('浙江大学'),
  ('南京大学'), ('武汉大学'), ('华中科技大学'), ('中山大学'), ('四川大学'),
  ('西安交通大学'), ('哈尔滨工业大学'), ('同济大学'), ('北京航空航天大学'), ('电子科技大学'),
  ('中南大学'), ('吉林大学'), ('山东大学'), ('厦门大学'), ('天津大学'),
  ('中央财经大学'), ('上海财经大学'), ('中国传媒大学'), ('北京邮电大学'), ('华东师范大学'),
  ('华南理工大学'), ('大连理工大学'), ('重庆大学'), ('湖南大学'), ('兰州大学')
on conflict (name) do nothing;
