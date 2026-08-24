-- ============================================================
-- 评论表（帖子 / 任务 / 商品通用评论）
-- ============================================================

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('task', 'post', 'goods')),
  target_id uuid not null,
  author_id uuid references profiles(id) on delete cascade,
  author_name text not null,
  author_avatar text default '',
  content text not null,
  created_at timestamptz default now()
);

create index idx_comments_target on comments(target_type, target_id);
create index idx_comments_author on comments(author_id);

alter table comments enable row level security;

-- 所有人可读
create policy "comments_select" on comments for select using (true);
-- 任何人可写（演示环境；真实环境应限制已登录用户）
create policy "comments_insert" on comments for insert with check (true);
-- 作者本人可删除
create policy "comments_delete" on comments for delete using (
  author_id::text = auth.uid()::text or auth.role() = 'admin'
);
