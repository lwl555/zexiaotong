import { useState } from 'react'
import { Ban, CheckCircle2, Download, Search } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, confirmDanger } from './ui'

export default function Users() {
  const users = useStore(s => s.users)
  const banUser = useStore(s => s.banUser)
  const unbanUser = useStore(s => s.unbanUser)
  const [kw, setKw] = useState('')

  let list = users
  if (kw) list = users.filter(u => u.nickname.includes(kw) || u.phone.includes(kw))

  const exportCsv = () => {
    const head = 'id,昵称,手机号,余额,冻结,状态,注册时间\n'
    const rows = users.map(u => `${u.id},${u.nickname},${u.phone},${u.balance},${u.frozen},${u.status},${u.created_at}`).join('\n')
    const blob = new Blob(['\ufeff' + head + rows], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'users.csv'
    a.click()
  }

  return (
    <div>
      <PageHeader title="用户管理" desc="查看、封禁 / 解封用户，导出用户清单">
        <button className="btn-ghost" onClick={exportCsv}><Download size={16} /> 导出 CSV</button>
      </PageHeader>

      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 mb-4 max-w-sm">
        <Search size={18} className="text-gray-400" />
        <input className="bg-transparent outline-none text-sm flex-1" placeholder="搜索昵称 / 手机号" value={kw} onChange={e => setKw(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">用户</th>
              <th className="text-left font-medium px-4 py-3">手机号</th>
              <th className="text-right font-medium px-4 py-3">余额</th>
              <th className="text-right font-medium px-4 py-3">冻结</th>
              <th className="text-center font-medium px-4 py-3">状态</th>
              <th className="text-right font-medium px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map(u => (
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
                <td className="px-4 py-3 text-gray-600">{u.phone}</td>
                <td className="px-4 py-3 text-right text-ink font-medium">¥{u.balance.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-500">¥{u.frozen.toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  {u.status === 'banned'
                    ? <StatusBadge text="已封禁" tone="red" />
                    : <StatusBadge text="正常" tone="green" />}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.status === 'banned'
                    ? <button className="text-green-600 text-xs font-medium" onClick={() => unbanUser(u.id)}><CheckCircle2 size={14} className="inline" /> 解封</button>
                    : <button className="text-red-500 text-xs font-medium" onClick={() => { if (confirmDanger('确认封禁该用户？封禁后其无法登录与接单。')) banUser(u.id) }}><Ban size={14} className="inline" /> 封禁</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
