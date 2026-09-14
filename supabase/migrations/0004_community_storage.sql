-- 0004_community_storage.sql
-- 社区配图存储桶。
-- 背景：智能体生成配图时，图片平台的返回是**临时 URL**（会过期），直接存进帖子会导致图片失效；
-- 因此 Edge Function 生成后先下载再转存到本 bucket，帖子里存的是本平台的持久公开地址。
-- public = true：任何人可读（帖子配图需直接可显示）；写入由 Edge Function 用 service_role 完成（绕过 RLS）。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community', 'community', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

-- 公开读策略（bucket 已 public，这里显式声明，避免匿名读取被策略挡住）
drop policy if exists "community_public_read" on storage.objects;
create policy "community_public_read" on storage.objects
  for select using (bucket_id = 'community');
