-- 0010_community_boards.sql
-- 补建「避雷清单」与「搞钱项目」两张公共看板表。
-- 这两个页面（Warnings.tsx / Money.tsx / mobile/Money.tsx）一直直连 anon 读写，但缺建表迁移，
-- 导致查询/插入/删除全失败（页面永远空、发布无效）。表结构取自页面实际字段。
--
-- 这是人人可看可加可删的公共看板（页面 UI 本就无所有权校验），故 RLS 用 using(true) 全开，
-- 与平台既有公共内容（posts/comments/bulletins）策略一致。

-- ── 避雷清单 ──
create table if not exists warnings (
  id uuid primary key default gen_random_uuid(),
  target_type text not null default 'school',   -- 'school' | 'company'
  title text not null,
  content text not null,
  tags text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_warnings_created on warnings (created_at desc);

alter table warnings enable row level security;
drop policy if exists warnings_public on warnings;
create policy warnings_public on warnings for all using (true) with check (true);

-- ── 搞钱项目 ──
create table if not exists money_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '兼职',         -- 兼职 | 副业 | 创业 | 悬赏任务
  description text not null,
  contact text default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_money_projects_created on money_projects (created_at desc);

alter table money_projects enable row level security;
drop policy if exists money_projects_public on money_projects;
create policy money_projects_public on money_projects for all using (true) with check (true);
