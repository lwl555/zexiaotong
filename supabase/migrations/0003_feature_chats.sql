-- ============================================================
-- 功能通知聊天表（首页每个功能块点进去的「通知聊天界面」）
-- 系统自动通知 / 用户回复 / 管理员下发 都存这里，
-- 后台「功能反馈」页按功能查看，管理员可下发/回复。
-- ============================================================

create table if not exists feature_chats (
  id uuid primary key default gen_random_uuid(),
  feature text not null,                         -- 功能块 id，如 'baishitong'
  author_role text not null
    check (author_role in ('system', 'user', 'admin')),
  author_id text not null,                       -- 用户 uuid / 'system' / 'admin'
  author_name text not null,
  content text not null,
  created_at timestamptz default now()
);

create index if not exists idx_feature_chats_feature on feature_chats(feature);
create index if not exists idx_feature_chats_created on feature_chats(created_at);

alter table feature_chats enable row level security;

-- 所有人可读（演示环境；与 comments 策略一致）
drop policy if exists "feature_chats_select" on feature_chats;
create policy "feature_chats_select" on feature_chats for select using (true);

-- 任何人可写（演示环境：系统/用户/管理员消息都经前端写入）
drop policy if exists "feature_chats_insert" on feature_chats;
create policy "feature_chats_insert" on feature_chats for insert with check (true);

-- 允许删除（清理用）
drop policy if exists "feature_chats_delete" on feature_chats;
create policy "feature_chats_delete" on feature_chats for delete using (true);
