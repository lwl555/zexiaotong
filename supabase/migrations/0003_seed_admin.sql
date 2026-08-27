-- ============================================================
-- 0003 真实管理员账号（系统按 role 字段识别，非前端硬编码）
-- 执行：Supabase Dashboard → SQL Editor 粘贴执行一次即可
-- 该账号与前端 hash.ts 的算法一致：password_hash = sha256('18882632073:110110nm')
-- ============================================================

-- 确保密码字段存在（若 0002 未执行，这里一并补上，避免登录报"数据库尚未升级"）
alter table profiles add column if not exists password_hash text;

-- 插入真实管理员；若 phone 已存在（如历史游客账号）则升级为 admin 而非报错
insert into profiles (phone, nickname, avatar, role, balance, frozen, status, password_hash)
values (
  '18882632073',
  '平台管理员',
  '',
  'admin',
  0,
  0,
  'active',
  encode(sha256('18882632073:110110nm'::bytea), 'hex')
)
on conflict (phone) do update set
  role         = 'admin',
  password_hash = excluded.password_hash,
  status       = 'active',
  nickname     = coalesce(profiles.nickname, '平台管理员');
