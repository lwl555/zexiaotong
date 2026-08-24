-- ============================================================
-- 择校通 Supabase 数据库初始化
-- 执行：在 Supabase Dashboard → SQL Editor 中粘贴执行
-- 或在本地: supabase db push
-- ============================================================

-- 1. 用户表（profiles）
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  nickname text not null,
  avatar text default '',
  role text default 'user' check (role in ('user', 'admin')),
  balance numeric(10,2) default 0,
  frozen numeric(10,2) default 0,
  status text default 'active' check (status in ('active', 'banned')),
  created_at timestamptz default now()
);

-- 2. 任务表（tasks）
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  amount numeric(10,2) not null,
  deadline timestamptz not null,
  description text default '',
  images text[] default '{}',
  poster_id uuid references profiles(id) on delete cascade,
  poster_name text not null,
  poster_avatar text default '',
  status text default 'open' check (status in ('open', 'accepted', 'doing', 'review', 'done', 'arbitration', 'closed')),
  accepted_id uuid references profiles(id) on delete set null,
  accepted_name text,
  top_until timestamptz,
  created_at timestamptz default now()
);

-- 3. 二手商品表（goods）
create table if not exists goods (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  price numeric(10,2) not null,
  category text not null,
  description text default '',
  images text[] default '{}',
  seller_id uuid references profiles(id) on delete cascade,
  seller_name text not null,
  status text default 'on' check (status in ('on', 'off', 'removed')),
  created_at timestamptz default now()
);

-- 4. 社区帖子表（posts）
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text default '',
  images text[] default '{}',
  author_id uuid references profiles(id) on delete cascade,
  author_name text not null,
  author_avatar text default '',
  likes int default 0,
  collects int default 0,
  comments int default 0,
  status text default 'on' check (status in ('on', 'off', 'removed')),
  created_at timestamptz default now()
);

-- 5. 私信表（messages）
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conv_id text not null,
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  content text not null,
  type text default 'text' check (type in ('text', 'image')),
  read boolean default false,
  created_at timestamptz default now()
);

-- 6. 钱包流水表（txns）
create table if not exists txns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('recharge', 'income', 'pay', 'withdraw', 'commission', 'refund', 'freeze', 'unfreeze')),
  amount numeric(10,2) not null,
  balance_after numeric(10,2) not null,
  remark text default '',
  created_at timestamptz default now()
);

-- 7. 提现申请表（withdrawals）
create table if not exists withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  user_name text not null,
  amount numeric(10,2) not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text default '',
  created_at timestamptz default now(),
  handled_at timestamptz
);

-- 8. 仲裁表（arbitrations）
create table if not exists arbitrations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  task_title text not null,
  order_id text default '',
  plaintiff_id uuid references profiles(id) on delete cascade,
  plaintiff_name text not null,
  defendant_id uuid references profiles(id) on delete cascade,
  defendant_name text not null,
  reason text default '',
  evidence text default '',
  result text default '',
  winner text check (winner in ('plaintiff', 'defendant', 'split', null)),
  status text default 'open' check (status in ('open', 'closed')),
  created_at timestamptz default now()
);

-- 9. 通知表（notifications）
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text not null check (type in ('task_status', 'task_taken', 'task_review', 'arbitration', 'comment', 'message', 'announce')),
  title text not null,
  content text default '',
  read boolean default false,
  created_at timestamptz default now()
);

-- 10. 分类表（categories）
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('task', 'goods')),
  name text not null
);

-- 11. 轮播图表（banners）
create table if not exists banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image text default '',
  url text default ''
);

-- 12. 平台配置表（platform_config）
create table if not exists platform_config (
  id serial primary key,
  commission_rate numeric(4,2) default 0.10,
  top_price_d1 numeric(10,2) default 2,
  top_price_d3 numeric(10,2) default 5,
  top_price_d7 numeric(10,2) default 10,
  announce text default ''
);

-- ============================================================
-- 索引（加速查询）
-- ============================================================
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_poster on tasks(poster_id);
create index if not exists idx_tasks_accepted on tasks(accepted_id);
create index if not exists idx_goods_seller on goods(seller_id);
create index if not exists idx_goods_status on goods(status);
create index if not exists idx_posts_author on posts(author_id);
create index if not exists idx_posts_status on posts(status);
create index if not exists idx_messages_conv on messages(conv_id);
create index if not exists idx_messages_receiver on messages(receiver_id);
create index if not exists idx_txns_user on txns(user_id);
create index if not exists idx_withdrawals_user on withdrawals(user_id);
create index if not exists idx_withdrawals_status on withdrawals(status);
create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_arbitrations_status on arbitrations(status);

-- ============================================================
-- 启用 RLS（Row Level Security）
-- ============================================================
alter table profiles enable row level security;
alter table tasks enable row level security;
alter table goods enable row level security;
alter table posts enable row level security;
alter table messages enable row level security;
alter table txns enable row level security;
alter table withdrawals enable row level security;
alter table arbitrations enable row level security;
alter table notifications enable row level security;
alter table categories enable row level security;
alter table banners enable row level security;
alter table platform_config enable row level security;

-- ============================================================
-- RLS 策略
-- ============================================================

-- profiles：所有人可读，本人可写
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select using (true);
drop policy if exists "profiles_insert" on profiles;
create policy "profiles_insert" on profiles for insert with check (true);
drop policy if exists "profiles_update" on profiles;
create policy "profiles_update" on profiles for update using (
  auth.uid()::text = id::text or auth.role() = 'admin'
);
drop policy if exists "profiles_admin" on profiles;
create policy "profiles_admin" on profiles for all using (auth.role() = 'admin');

-- tasks：所有人可读，本人/管理员可写
drop policy if exists "tasks_select" on tasks;
create policy "tasks_select" on tasks for select using (true);
drop policy if exists "tasks_insert" on tasks;
create policy "tasks_insert" on tasks for insert with check (
  auth.uid()::text = poster_id::text
);
drop policy if exists "tasks_update_owner" on tasks;
create policy "tasks_update_owner" on tasks for update using (
  auth.uid()::text = poster_id::text or auth.uid()::text = accepted_id::text
);
drop policy if exists "tasks_admin" on tasks;
create policy "tasks_admin" on tasks for all using (auth.role() = 'admin');

-- goods：所有人可读，本人可写
drop policy if exists "goods_select" on goods;
create policy "goods_select" on goods for select using (true);
drop policy if exists "goods_insert" on goods;
create policy "goods_insert" on goods for insert with check (
  auth.uid()::text = seller_id::text
);
drop policy if exists "goods_update" on goods;
create policy "goods_update" on goods for update using (
  auth.uid()::text = seller_id::text
);
drop policy if exists "goods_admin" on goods;
create policy "goods_admin" on goods for all using (auth.role() = 'admin');

-- posts：所有人可读，本人可写
drop policy if exists "posts_select" on posts;
create policy "posts_select" on posts for select using (true);
drop policy if exists "posts_insert" on posts;
create policy "posts_insert" on posts for insert with check (
  auth.uid()::text = author_id::text
);
drop policy if exists "posts_update" on posts;
create policy "posts_update" on posts for update using (
  auth.uid()::text = author_id::text
);
drop policy if exists "posts_admin" on posts;
create policy "posts_admin" on posts for all using (auth.role() = 'admin');

-- messages：参与者可读，发送者可写
drop policy if exists "messages_select" on messages;
create policy "messages_select" on messages for select using (
  auth.uid()::text = sender_id::text or auth.uid()::text = receiver_id::text
);
drop policy if exists "messages_insert" on messages;
create policy "messages_insert" on messages for insert with check (
  auth.uid()::text = sender_id::text
);

-- txns：本人可读
drop policy if exists "txns_select" on txns;
create policy "txns_select" on txns for select using (
  auth.uid()::text = user_id::text
);

-- withdrawals：本人可读，管理员可写
drop policy if exists "withdrawals_select" on withdrawals;
create policy "withdrawals_select" on withdrawals for select using (
  auth.uid()::text = user_id::text
);
drop policy if exists "withdrawals_insert" on withdrawals;
create policy "withdrawals_insert" on withdrawals for insert with check (
  auth.uid()::text = user_id::text
);
drop policy if exists "withdrawals_admin" on withdrawals;
create policy "withdrawals_admin" on withdrawals for all using (auth.role() = 'admin');

-- arbitrations：参与者可读，管理员可写
drop policy if exists "arbitrations_select" on arbitrations;
create policy "arbitrations_select" on arbitrations for select using (
  auth.uid()::text = plaintiff_id::text or auth.uid()::text = defendant_id::text
);
drop policy if exists "arbitrations_admin" on arbitrations;
create policy "arbitrations_admin" on arbitrations for all using (auth.role() = 'admin');

-- notifications：本人可读
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select using (
  auth.uid()::text = user_id::text
);
drop policy if exists "notifications_insert" on notifications;
create policy "notifications_insert" on notifications for insert with check (
  auth.uid()::text = user_id::text
);

-- categories / banners / platform_config：所有人可读，管理员可写
drop policy if exists "categories_select" on categories;
create policy "categories_select" on categories for select using (true);
drop policy if exists "banners_select" on banners;
create policy "banners_select" on banners for select using (true);
drop policy if exists "platform_config_select" on platform_config;
create policy "platform_config_select" on platform_config for select using (true);

-- ============================================================
-- 初始数据
-- ============================================================

-- 默认平台配置
insert into platform_config (commission_rate, top_price_d1, top_price_d3, top_price_d7, announce)
values (0.10, 2, 5, 10, '欢迎使用择校通，发布任务前请阅读用户协议，文明交易。')
on conflict do nothing;

-- 默认分类
insert into categories (kind, name) values
  ('task', '悬赏'), ('task', '跑腿'), ('task', '文档设计'), ('task', '问卷'),
  ('goods', '数码'), ('goods', '出行'), ('goods', '书籍'), ('goods', '日用')
on conflict do nothing;

-- 默认轮播
insert into banners (title, image, url) values
  ('新学期悬赏季', '', ''),
  ('闲置变现 0 门槛', '', '')
on conflict do nothing;

-- 默认管理员（需要先在 Auth 创建用户后更新 id）
-- insert into profiles (id, phone, nickname, role) VALUES
--   ('<auth_admin_uuid>', '13900005678', '平台管理员', 'admin');
