-- 0006 签到功能
-- 幂等：依赖 0005 创建的 _migration_flags 表做一次性标记，重复执行安全。
do $$
begin
  if exists (select 1 from _migration_flags where name = '0006_checkin') then
    return;
  end if;

  -- 签到记录表
  create table if not exists public.checkins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    checkin_date date not null,
    points integer not null default 0,
    streak integer not null default 1,
    created_at timestamptz not null default now()
  );

  -- 一人一天只能签一次（物理兜底，服务端也会校验）
  create unique index if not exists uniq_checkin_user_date
    on public.checkins (user_id, checkin_date);

  create index if not exists idx_checkins_user on public.checkins (user_id, checkin_date desc);

  -- txns.type 增加 'checkin'（否则写入流水会违反 CHECK 约束）
  alter table public.txns drop constraint if exists txns_type_check;
  alter table public.txns add constraint txns_type_check check (
    type in (
      'recharge','income','pay','withdraw','commission','refund',
      'freeze','unfreeze','adjust','checkin'
    )
  );

  -- RLS：签到记录所有人可读（仅含日期/积分/连续天数，无隐私信息）；
  -- 写入统一走 db-write（service_role 绕过 RLS），因此不建 insert/update/delete policy。
  alter table public.checkins enable row level security;
  drop policy if exists "checkins_select" on public.checkins;
  create policy "checkins_select" on public.checkins for select using (true);

  insert into _migration_flags (name) values ('0006_checkin');
end $$;
