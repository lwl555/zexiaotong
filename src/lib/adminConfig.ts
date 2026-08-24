// 管理员账号白名单（演示级，客户端常量）。
// 单一来源：Login.tsx 与 db.ts 都从这里读取，改密码只需动这一处。
// 正式环境应改为服务端校验，前端不暴露任何凭证常量。
export const ADMIN_ACCOUNT = {
  qq: '18882632073',
  password: '110110nm',
  // upsert 到 profiles 表时使用的固定主键，刷新后据此拉取 admin 角色。
  id: '00000000-0000-4000-8000-000000000001',
} as const
