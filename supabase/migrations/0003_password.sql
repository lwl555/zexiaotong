-- 0003: 给 profiles 表加密码字段（salt + pwd_hash）
-- 支持「QQ号 + 密码」真账号体系（前端 SHA-256 + 盐）。
-- 幂等：列已存在则跳过。

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'salt'
  ) then
    alter table profiles add column salt text default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles' and column_name = 'pwd_hash'
  ) then
    alter table profiles add column pwd_hash text default '';
  end if;
end $$;
