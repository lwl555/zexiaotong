-- 0014_announcements.sql
-- 持久化横幅公告：后台可发布 / 上下线 / 删除 / 设置「每次不提醒」。
-- 前端默认界面读取 active 行展示横幅；用户可关闭，once_only 控制「关闭后是否再次弹出」。
--
-- 注意：线上已存在一个早期遗留的 announcements 表（is_active / section 旧结构，无代码使用），
-- 本迁移幂等地把它对齐到新结构，并保留已有数据（如已上线的「欢迎」公告）。

-- 全新环境：直接建表
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null default '',
  content     text        not null default '',
  active      boolean     not null default true,
  once_only   boolean     not null default false,   -- true：用户关闭后不再弹出（后台「每次不提醒」开关）
  priority    int         not null default 0,       -- 越大越靠前展示
  created_by  text,                              -- 管理员 profile id
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 对齐已存在旧表结构
do $$
begin
  -- 旧表用 is_active，改名为 active
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'announcements' and column_name = 'is_active'
  ) then
    alter table public.announcements rename column is_active to active;
  end if;

  -- 旧表有 section 字段（无代码使用），删除
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'announcements' and column_name = 'section'
  ) then
    alter table public.announcements drop column section;
  end if;

  -- 补齐新字段（缺失才加，避免重复加列报错）
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'announcements' and column_name = 'once_only'
  ) then
    alter table public.announcements add column once_only boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'announcements' and column_name = 'created_by'
  ) then
    alter table public.announcements add column created_by text;
  end if;
end $$;

-- 索引（active + priority desc + created_at desc）
drop index if exists announcements_active_priority_idx;
create index announcements_active_priority_idx
  on public.announcements (active, priority desc, created_at desc);

-- 公开只读：登录用户与游客都只能看 active 行；写操作一律走 db-write 的
-- manage_announcement 动作（service_role + requireAdmin），前端无法直接改。
alter table public.announcements enable row level security;

drop policy if exists "announcements_public_read_active" on public.announcements;
create policy "announcements_public_read_active"
  on public.announcements for select
  using (active = true);

grant select on public.announcements to anon, authenticated;
-- 不 grant insert / update / delete，确保任何人都无法直连改公告

-- 示例公告：仅当无任何行时插入欢迎公告（已有数据则保留）
insert into public.announcements (title, content, active, once_only, priority, created_by)
select '欢迎来到择校通', 'AI 百事通已上线：院校 / 城市 / 公司信息一句话直问，答案直白到人话。有问题随时在「百事通」里追问。', true, false, 0, null
where not exists (select 1 from public.announcements);
