-- 0009 修复早期游客账号的账实差异
--
-- 体检发现：游客账号「游客e3e6」有一条签到流水 +10，但余额是 0（balance - txn_sum = -10）。
-- 属于早期签到写入不完整的遗留（很可能是当时余额写入失败）。金额可忽略，但会让
-- 资金对账一直报一条固定异常，故把余额对齐到流水累计，使账面重新对平。
--
-- ⚠️ 修正记录（2026-09-18）：本文件 v1 版本写过一次错——当时既插入了一条「补记」流水、
-- 又把余额设成旧的流水累计，等于同一笔积分被计入两次；结果差异从 -10 变成 -10（流水累计翻倍）。
-- 正确做法是 **只把余额对齐到已有流水累计，不要额外补流水**（那 10 分的流水本来就存在）。
-- 生产库已用一次性 SQL 修正到位，本文件同步改为正确逻辑。
--
-- 幂等：依赖 _migration_flags 标记，重复执行安全。逻辑本身也为收敛式（对齐即对平）。
do $$
declare
  v_uid uuid;
  v_sum numeric(10,2);
begin
  if exists (select 1 from _migration_flags where name = '0009_fix_guest_balance') then
    return;
  end if;

  -- 找出「余额低于流水累计（扣除冻结）」的游客账号（无手机号 = 游客），把余额对齐到流水累计。
  -- 不插入新流水：缺失的那笔流水本来就存在，缺的只是余额字段的同步。
  select p.id, coalesce(a.s, 0)
    into v_uid, v_sum
  from public.profiles p
  left join (select user_id, sum(amount) s from public.txns group by user_id) a on a.user_id = p.id
  where p.phone = '' and p.balance < coalesce(a.s, 0) - p.frozen
  order by (coalesce(a.s, 0) - p.balance) desc
  limit 1;

  if v_uid is not null then
    update public.profiles set balance = v_sum where id = v_uid;

    insert into public.activity_logs (actor_type, actor_id, actor_name, action, target_type, target_id, detail)
    values ('system', 'system', '系统', 'points_repair', 'user', v_uid::text,
            '将余额对齐到流水累计 ' || v_sum || ' 积分，修复账实差异');
  end if;

  insert into _migration_flags (name) values ('0009_fix_guest_balance');
end $$;
