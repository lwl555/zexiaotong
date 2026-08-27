import { useState, useEffect, useCallback } from 'react'
import { Ban, CheckCircle2, Download, Search, Trash2, Loader2, RefreshCw } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import { PageHeader, StatusBadge, confirmDanger } from './ui'
import {
  adminListUsers, adminFreezeUser, adminUnfreezeUser, adminDeleteUser
} from '../../lib/db'
import type { Profile } from '../../lib/types'

export default function Users() {
  const showToast = useStore((s) => s.showToast)
  const me = useMe()
  const operatorId = me?.id

  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [kw, setKw] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await adminListUsers(0)
      setUsers(list)
    } catch (e: any) {
      showToast('err', e?.message || '加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  let list = users
  if (kw) list = users.filter(u => (u.nickname || '').includes(kw) || (u.qq || '').includes(kw))

  const exportCsv = () => {
    const head = 'id,昵称,QQ号,余额,冻结,状态,注册时间\n'
    const rows = users.map(u => `${u.id},${u.nickname},${u.qq},${u.balance},${u.frozen},${u.status},${u.created_at}`).join('\n')
    const blob = new Blob(['\ufeff' + head + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'users.csv'
    a.click()
  }

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id)
    try { await fn() }
    catch (e: any) { showToast('err', e?.message || '操作失败') }
    finally { setBusyId(null) }
  }

  const handleFreeze = (u: Profile) => {
    if (!operatorId) return
    if (!confirmDanger(`确认冻结用户「${u.nickname}」？\n冻结后该账号将无法登录、接单与发布。`)) return
    withBusy(u.id, async () => {
      await adminFreezeUser(operatorId, u.id)
      setUsers(us => us.map(x => x.id === u.id ? { ...x, status: 'banned' } : x))
      showToast('ok', `已冻结用户「${u.nickname}」`)
    })
  }

  const handleUnfreeze = (u: Profile) => {
    if (!operatorId) return
    if (!confirmDanger(`确认解封用户「${u.nickname}」？`)) return
    withBusy(u.id, async () => {
      await adminUnfreezeUser(operatorId, u.id)
      setUsers(us => us.map(x => x.id === u.id ? { ...x, status: 'active' } : x))
      showToast('ok', `已解封用户「${u.nickname}」`)
    })
  }

  const handleDelete = (u: Profile) => {
    if (!operatorId) return
    if (!confirmDanger(
      `⚠️ 确认永久删除用户「${u.nickname}」？\n\n此操作将真实删除该账号及其发布的任务、二手商品、社区帖子、私信、钱包流水等全部数据，不可恢复！`
    )) return
    withBusy(u.id, async () => {
      await adminDeleteUser(operatorId, u.id)
      setUsers(us => us.filter(x => x.id !== u.id))
      showToast('ok', `已永久删除用户「${u.nickname}」`)
    })
  }

  return (
    <div>
      <PageHeader title="用户管理" desc="查看、冻结 / 解封 / 删除账号（删除为真实删除，不可恢复）">
        <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> 导出 CSV</button>
        <button className="btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </PageHeader>

      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-4 max-w-sm">
        <Search size={18} className="text-gray-400" />
        <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索昵称 / QQ号" value={kw} onChange={e => setKw(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">用户</th>
              <th className="text-left font-medium px-4 py-3">QQ号</th>
              <th className="text-right font-medium px-4 py-3">余额</th>
              <th className="text-right font-medium px-4 py-3">冻结</th>
              <th className="text-center font-medium px-4 py-3">状态</th>
              <th className="text-right font-medium px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                <Loader2 size={20} className="inline animate-spin" /> 加载中…
              </td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">暂无用户</td></tr>
            )}
            {!loading && list.map(u => {
              const isAdmin = u.role === 'admin'
              const isSelf = u.id === operatorId
              const busy = busyId === u.id
              return (
                <tr key={u.id} className="border-t border-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <img src={u.avatar} className="w-8 h-8 rounded-full bg-gray-100" alt="" />
                      <div>
                        <div className="font-medium text-ink">{u.nickname}</div>
                        <div className="text-xs text-gray-400">{u.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.qq}</td>
                  <td className="px-4 py-3 text-right text-ink font-medium">¥{(u.balance ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">¥{(u.frozen ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    {u.status === 'banned'
                      ? <StatusBadge text="已冻结" tone="red" />
                      : <StatusBadge text="正常" tone="green" />}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {isAdmin
                      ? <span className="text-xs text-gray-400">管理员</span>
                      : isSelf
                        ? <span className="text-xs text-gray-400">本人</span>
                        : <>
                            {u.status === 'banned'
                              ? <button className="text-green-600 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50" disabled={busy} onClick={() => handleUnfreeze(u)}>
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} 解封</button>
                              : <button className="text-amber-600 text-xs font-medium inline-flex items-center gap-1 disabled:opacity-50" disabled={busy} onClick={() => handleFreeze(u)}>
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={14} />} 冻结</button>}
                            <button className="text-red-500 text-xs font-medium ml-3 inline-flex items-center gap-1 disabled:opacity-50" disabled={busy} onClick={() => handleDelete(u)}>
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />} 删除</button>
                          </>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
