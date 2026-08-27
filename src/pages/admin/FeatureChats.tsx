import { useEffect, useState } from 'react'
import { supabase } from '../../lib/db'
import { FEATURES, FeatureChatMsg, FeatureRole } from '../../lib/featureChat'

const ROLE_BADGE: Record<FeatureRole, { label: string; cls: string }> = {
  system: { label: '系统', cls: 'bg-gray-100 text-gray-500' },
  user: { label: '用户', cls: 'bg-blue-50 text-blue-600' },
  admin: { label: '管理员', cls: 'bg-green-50 text-green-600' },
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function FeatureChats() {
  const [rows, setRows] = useState<FeatureChatMsg[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [target, setTarget] = useState('baishitong')
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const load = async () => {
    if (!supabase) { setLoading(false); return }
    const { data, error } = await supabase
      .from('feature_chats')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    if (!error) setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendAsAdmin = async () => {
    const t = draft.trim()
    if (!t || posting || !supabase) return
    setPosting(true)
    const { error } = await supabase.from('feature_chats').insert({
      feature: target,
      author_role: 'admin',
      author_id: 'admin',
      author_name: '管理员',
      content: t,
    })
    setPosting(false)
    if (!error) { setDraft(''); load() }
  }

  const deleteMsg = async (msgId: string) => {
    if (!supabase) return
    if (!window.confirm('确定删除这条消息？删除后不可恢复。')) return
    const { error } = await supabase.from('feature_chats').delete().eq('id', msgId)
    if (!error) load()
  }

  const filtered = filter === 'all' ? rows : rows.filter(r => r.feature === filter)

  return (
    <div>
      <h1 className="text-xl font-bold text-ink mb-1">功能反馈</h1>
      <p className="text-sm text-gray-500 mb-4">
        用户在「功能通知聊天」里的回复、系统自动通知、以及管理员下发/回复，全部按功能汇总在此。
      </p>

      {/* 管理员下发/回复 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-ink">以管理员身份推送 / 回复</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={target}
            onChange={e => setTarget(e.target.value)}
            className="input sm:w-48"
          >
            {Object.values(FEATURES).map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendAsAdmin()}
            placeholder="输入要推送给该功能用户的内容…"
            className="input flex-1"
          />
          <button onClick={sendAsAdmin} disabled={!draft.trim() || posting} className="btn-primary sm:w-28">
            {posting ? '发送中…' : '发送'}
          </button>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm text-gray-500">筛选：</span>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="input sm:w-48">
          <option value="all">全部功能</option>
          {Object.values(FEATURES).map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">共 {filtered.length} 条</span>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center text-gray-400 py-10">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-10">暂无消息</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const badge = ROLE_BADGE[r.author_role]
            const f = FEATURES[r.feature]
            return (
              <div key={r.id} className="bg-white rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-medium text-ink">{f ? f.name : r.feature}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                  <span className="text-[11px] text-gray-400">
                    {r.author_role === 'user' ? '用户 ' + r.author_id.slice(0, 8) : r.author_name}
                  </span>
                  <span className="text-[11px] text-gray-300 ml-auto">{timeAgo(r.created_at)}</span>
                </div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap break-words">{r.content}</div>
                <div className="flex justify-end mt-1">
                  <button onClick={() => deleteMsg(r.id)} className="text-[11px] text-gray-400 hover:text-red-500 active:opacity-60">删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
