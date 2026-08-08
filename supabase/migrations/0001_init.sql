-- 择校通 · 公共看板数据表
-- 执行方式（在 Supabase 后台 SQL Editor 粘贴运行，或用 Supabase CLI）：
--   supabase db push   或   后台 → SQL Editor → 粘贴本文件 → Run

-- ============ 避雷清单 ============
create table if not exists public.warnings (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('school', 'company')),
  title text not null,
  content text not null,
  tags text default '',
  created_at timestamptz not null default now()
);

create index if not exists warnings_created_at_idx on public.warnings (created_at desc);

-- ============ 搞钱项目 ============
create table if not exists public.money_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '兼职',
  description text not null,
  contact text default '',
  created_at timestamptz not null default now()
);

create index if not exists money_projects_created_at_idx on public.money_projects (created_at desc);

-- ============ RLS ============
-- 设计：这是公共看板（人人可看、可发、可删），所以匿名角色(anon) 放开全权限。
-- ⚠️ 安全提示：匿名全开放意味着任何人都能改/删数据，适合 demo / 公共墙。
--    若要收紧（例如只允许本人删自己的）：增加一个 owner_token 列，
--    在应用端生成并随请求带入，把下面 delete/update 策略改为
--    using (owner_token = current_setting('request.headers')::json->>'x-owner-token')。
alter table public.warnings enable row level security;
alter table public.money_projects enable row level security;

-- warnings：匿名可读写
drop policy if exists "warnings_anon_all" on public.warnings;
create policy "warnings_anon_all" on public.warnings
  for all to anon using (true) with check (true);

-- money_projects：匿名可读写
drop policy if exists "money_projects_anon_all" on public.money_projects;
create policy "money_projects_anon_all" on public.money_projects
  for all to anon using (true) with check (true);
