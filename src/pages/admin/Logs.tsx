import { useEffect, useState } from 'react'
import { RefreshCw, Loader2, Bot, UserCog, User, Cpu } from 'lucide-react'
import { useStore } from '../../store/store'
import { PageHeader, StatusBadge, Empty } from './ui'
import type { ActorType } from '../../lib/types'

const ACTOR_META: Record<ActorType, { label: string; tone: 'brand' | 'red' | 'green' | 'gray'; icon: React.ReactNode }> = {
  user: { label: '用户', tone: 'brand', icon: <User size={13} /> },
  admin: { label: '管理员', tone: 'red', icon: <UserCog size={13} /> },
  bot: { label: '智能体', tone: 'green', icon: <Bot size={13} /> },
  system: { label: '系统', tone: 'gray', icon: <Cpu size={13} /> }
}

function timeStr(iso: string): string {
  try { return new Date(iso).toLocaleString('zh-CN', { hour12: false }) } catch { return iso }
}

export default function Logs() {
  const logs = useStore(s => s.logs)
  const fetchLogs = useStore(s => s.fetchLogs)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ActorType | 'all'>('all')

  useEffect(() => {
    setLoading(true)
    fetchLogs(filter === 'all' ? {} : { actor_type: filter }).finally(() => setLoading(false))
  }, [filter, fetchLogs])

  const list = logs

  return (
    <div>
      <PageHeader title="运行日志" desc="平台内智能体、管理员、用户与系统的关键操作记录">
        <button className="btn-ghost" onClick={() => { setLoading(true); fetchLogs(filter === 'all' ? {} : { actor_type: filter }).finally(() => setLoading(false)) }} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'user', 'admin', 'bot', 'system'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={'px-3 py-1.5 rounded-lg text-sm font-medium border ' + (filter === f ? 'bg-ink text-white border-ink' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}
          >
            {f === 'all' ? '全部' : ACTOR_META[f].label}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>
              <th className="text-left font-medium px-4 py-3">类型</th>
              <th className="text-left font-medium px-4 py-3">操作</th>
              <th className="text-left font-medium px-4 py-3">对象</th>
              <th className="text-left font-medium px-4 py-3">详情</th>
              <th className="text-left font-medium px-4 py-3">时间</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                <Loader2 size={20} className="inline animate-spin" /> 加载中…
              </td></tr>
            )}
            {!loading && list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">暂无日志</td></tr>
            )}
            {!loading && list.map(l => (
              <tr key={l.id} className="border-t border-gray-50 align-top">
                <td className="px-4 py-3">
                  <StatusBadge text={ACTOR_META[l.actor_type as ActorType]?.label || l.actor_type} tone={ACTOR_META[l.actor_type as ActorType]?.tone || 'gray'} />
                  <div className="text-xs text-gray-400 mt-1">{l.actor_name || l.actor_id?.slice(0, 8) || '-'}</div>
                </td>
                <td className="px-4 py-3 font-medium text-ink">{l.action}</td>
                <td className="px-4 py-3 text-gray-500">
                  {l.target_type ? `${l.target_type}${l.target_id ? ' #' + l.target_id.slice(0, 6) : ''}` : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs break-words">{l.detail || '-'}</td>
                <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{timeStr(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
