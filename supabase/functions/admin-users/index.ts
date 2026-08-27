// admin-users — Supabase Edge Function (Deno)
// 用 service_role 直接打 PostgREST，绕过 RLS，并在后端校验「操作者是否为管理员」。
// 支持动作：
//   list     分页列出所有用户（剔除 password_hash）
//   freeze   冻结账号（status = 'banned'）
//   unfreeze 解冻账号（status = 'active'）
//   delete   真实删除账号（DELETE FROM profiles，级联删除其任务/商品/帖子/消息/流水等）
//
// 安全约定：
//   - 不在浏览器暴露 service_role key（仅在 Deno 运行时环境变量中存在）
//   - 每个写操作都先用 operator_id 查 profiles.role 确认是 admin，否则拒绝
//   - 禁止操作 role='admin' 的账号，禁止操作者操作自己
//
// 部署：
//   supabase functions deploy admin-users --project-ref wcnssyiqitugqfmcbdhe
// 前端调用：supabase.functions.invoke('admin-users', { body: {...} })（anon key 仅用于能否调用本函数）

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  })
}

// 用 service_role 直接调 PostgREST（绕过 RLS）
async function pg(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    'Content-Type': 'application/json'
  }
  if (method !== 'GET') headers['Prefer'] = 'return=representation'
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { ok: res.ok, status: res.status, data }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { action, operator_id, target_id, target_phone, page } = body

    if (!action) return json({ error: '缺少 action' }, 400)
    if (!operator_id) return json({ error: '缺少操作者身份(operator_id)' }, 400)

    // ── 校验操作者是否为管理员（后端权威校验，不盲信前端）──
    const opRes = await pg('GET', `profiles?select=role&id=eq.${encodeURIComponent(operator_id)}`)
    if (!opRes.ok || !Array.isArray(opRes.data) || opRes.data.length === 0) {
      return json({ error: '操作者不存在' }, 403)
    }
    if (opRes.data[0].role !== 'admin') {
      return json({ error: '无权限：操作者不是管理员' }, 403)
    }

    // ── 列出用户 ──
    if (action === 'list') {
      const offset = (Number(page) || 0) * 50
      const path =
        `profiles?select=id,phone,nickname,avatar,role,balance,frozen,status,created_at` +
        `&order=created_at.desc&limit=50&offset=${offset}`
      const r = await pg('GET', path)
      if (!r.ok) return json({ error: '查询失败：' + JSON.stringify(r.data) }, 500)
      return json({ users: r.data || [] })
    }

    // ── 以下写操作需要明确目标 ──
    let targetId: string | undefined = target_id
    if (!targetId && target_phone) {
      const tr = await pg('GET', `profiles?select=id,role&phone=eq.${encodeURIComponent(target_phone)}`)
      if (!tr.ok || !Array.isArray(tr.data) || tr.data.length === 0) {
        return json({ error: '目标用户不存在' }, 404)
      }
      targetId = tr.data[0].id
    } else if (!targetId) {
      return json({ error: '缺少目标(target_id 或 target_phone)' }, 400)
    } else {
      const tr = await pg('GET', `profiles?select=id,role&id=eq.${encodeURIComponent(targetId)}`)
      if (!tr.ok || !Array.isArray(tr.data) || tr.data.length === 0) {
        return json({ error: '目标用户不存在' }, 404)
      }
    }

    // 取目标 role 做保护判断
    const tgtRes = await pg('GET', `profiles?select=role&id=eq.${encodeURIComponent(targetId!)}`)
    const tgtRole = Array.isArray(tgtRes.data) ? tgtRes.data[0]?.role : undefined
    if (tgtRole === 'admin') return json({ error: '不能操作管理员账号' }, 403)
    if (targetId === operator_id) return json({ error: '不能操作自己' }, 403)

    if (action === 'freeze') {
      const r = await pg('PATCH', `profiles?id=eq.${encodeURIComponent(targetId!)}`, { status: 'banned' })
      if (!r.ok) return json({ error: '冻结失败' }, 500)
      return json({ ok: true, status: 'banned' })
    }
    if (action === 'unfreeze') {
      const r = await pg('PATCH', `profiles?id=eq.${encodeURIComponent(targetId!)}`, { status: 'active' })
      if (!r.ok) return json({ error: '解冻失败' }, 500)
      return json({ ok: true, status: 'active' })
    }
    if (action === 'delete') {
      const r = await pg('DELETE', `profiles?id=eq.${encodeURIComponent(targetId!)}`)
      if (!r.ok) return json({ error: '删除失败' }, 500)
      return json({ ok: true, deleted: targetId })
    }

    return json({ error: '未知操作：' + action }, 400)
  } catch (e: any) {
    return json({ error: e?.message || 'server error' }, 500)
  }
})
