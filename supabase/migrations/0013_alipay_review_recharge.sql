-- 0013 手动支付宝充值 + 截图审核
-- 充值从「模拟收银台一键到账」改为「用户扫码转账 → 上传截图+金额+支付宝姓名 → 后台审核 → 通过才到账」。

-- 1) recharge_orders 增加审核所需字段
alter table public.recharge_orders
  add column if not exists alipay_name text not null default '',
  add column if not exists proof_url text not null default '',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text not null default '',
  add column if not exists reject_reason text not null default '';

-- 状态语义扩展：pending=待审核, approved=审核通过已到账, rejected=已驳回
-- （保留 paid/cancelled/expired 兼容历史数据：旧流程已 paid 的视为已到账）
alter table public.recharge_orders drop constraint if exists recharge_orders_status_check;
alter table public.recharge_orders
  add constraint recharge_orders_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled', 'paid', 'expired'));

-- 2) platform_config 增加支付宝收款配置（收款二维码 + 收款账号/姓名）
alter table public.platform_config
  add column if not exists alipay_qr_url text not null default '',
  add column if not exists alipay_account text not null default '';

-- 3) 存储桶 uploads（公开）：存放充值截图与收款二维码。
--    存储桶只能通过 Storage API 创建，不在此 DDL 内；
--    实际创建命令：supabase storage buckets create uploads --public
