-- ============================================================
-- 0002 登录/注册密码支持
-- 给 profiles 表增加 password_hash 列（可空，兼容老用户）
-- 前端注册时写入 SHA-256(qq:password)，登录时 select 比对。
-- 执行方式：Supabase Dashboard → SQL Editor 粘贴执行；或 supabase db push
-- ============================================================

alter table profiles
  add column if not exists password_hash text default null;

comment on column profiles.password_hash is
  '密码哈希（前端 SHA-256(qq:password)），可空表示未设置密码（老游客账号）';

-- 仅给真实注册用户建索引（password_hash 非空），加快按 qq 查登录
-- 注意：phone 已 unique，以下索引用于「按 phone 找并校验 hash」场景
create index if not exists idx_profiles_phone_hash
  on profiles (phone) where password_hash is not null;
