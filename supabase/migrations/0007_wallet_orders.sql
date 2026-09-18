-- 0007 钱包改造：充值订单（幂等入账）+ 提现收款信息
-- 幂等：依赖 0005 创建的 _migration_flags 表做一次性标记，重复执行安全。
do $$
begin
  if exists (select 1 from _migration_flags where name = '0007_wallet_orders') then
    return;
  end if;

  -- 充值订单表：充值从「点一下直接加钱」改为「下单 →（模拟）支付 → 入账」三步。
  -- 幂等的关键：confirm 时用 `update ... where id=? and status='pending'` 抢单，
  -- 只有抢到的那一次请求才入账 —— 连点 / 重放 / 并发重复提交都只会到账一次。
  create table if not exists public.recharge_orders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    amount_yuan numeric(10,2) not null check (amount_yuan > 0),
    points integer not null check (points > 0),
    status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled', 'expired')),
    channel text not null default 'mock',
    paid_at timestamptz,
    created_at timestamptz not null default now()
  );

  create index if not exists idx_recharge_orders_user
    on public.recharge_orders (user_id, created_at desc);

  -- 提现申请表补收款信息（原表没有这三列，管理员看到申请也不知道该打给谁）
  alter table public.withdrawals add column if not exists channel text not null default '';
  alter table public.withdrawals add column if not exists account text not null default '';
  alter table public.withdrawals add column if not exists account_name text not null default '';

  -- RLS：仅开放读（写入统一走 db-write 的 service_role，绕过 RLS）
  alter table public.recharge_orders enable row level security;
  drop policy if exists "recharge_orders_select" on public.recharge_orders;
  create policy "recharge_orders_select" on public.recharge_orders for select using (true);

  insert into _migration_flags (name) values ('0007_wallet_orders');
end $$;
