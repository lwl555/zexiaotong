import { useEffect, useState } from 'react'
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Loader2, CheckCircle, X } from 'lucide-react'
import { useMe } from '../../store/useMe'
import { manageAnnouncement, type Announcement } from '../../lib/db'
import { PageHeader } from './ui'

export default function Announcements() {
  const me = useMe()
  const [list, setList] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [draft, setDraft] = useState({ title: '', content: '', priority: 0, once_only: false, active: true })

  const load = async () => {
    if (!me?.id) return
    setLoading(true)
    setErr('')
    try {
      const d = await manageAnnouncement('list', { uid: me.id })
      setList(d.announcements || [])
    } catch (e: any) {
      setErr(e?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id])

  const openNew = () => {
    setEditing(null)
    setDraft({ title: '', content: '', priority: 0, once_only: false, active: true })
    setFormOpen(true)
  }
  const openEdit = (a: Announcement) => {
    setEditing(a)
    setDraft({ title: a.title, content: a.content, priority: a.priority, once_only: a.once_only, active: a.active })
    setFormOpen(true)
  }
  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const submit = async () => {
    if (!draft.title.trim() && !draft.content.trim()) {
      alert('标题与内容不能同时为空')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await manageAnnouncement('update', {
          uid: me!.id,
          id: editing.id,
          title: draft.title,
          content: draft.content,
          priority: draft.priority,
          once_only: draft.once_only,
          active: draft.active
        })
      } else {
        await manageAnnouncement('create', { uid: me!.id, ...draft })
      }
      closeForm()
      await load()
    } catch (e: any) {
      alert(e?.message || '保存失败')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (a: Announcement) => {
    setBusy(true)
    try {
      await manageAnnouncement('update', { uid: me!.id, id: a.id, active: !a.active })
      await load()
    } catch (e: any) {
      alert(e?.message || '操作失败')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (a: Announcement) => {
    if (!confirm(`确定删除公告「${a.title || '(无标题)'}」？删除后前台不再展示。`)) return
    setBusy(true)
    try {
      await manageAnnouncement('delete', { uid: me!.id, id: a.id })
      await load()
    } catch (e: any) {
      alert(e?.message || '删除失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader title="公告管理" desc="发布全站横幅公告，设置上线 / 下线、优先级与「每次不提醒」">
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> 新建公告
        </button>
      </PageHeader>

      {loading && (
        <div className="card p-10 flex items-center justify-center text-gray-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      )}
      {err && <div className="card p-6 text-red-500 text-sm">{err}</div>}

      {!loading && !err && list.length === 0 && (
        <div className="card p-10 text-center text-gray-400 text-sm">
          暂无公告，点击右上角「新建公告」发布第一条。
        </div>
      )}

      {!loading &&
        !err &&
        list.map((a) => (
          <div key={a.id} className="card p-4 mb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-ink">{a.title || <span className="text-gray-400 font-normal">（无标题）</span>}</span>
                  {a.active ? (
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-xs">已上线</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-400 text-xs">已下线</span>
                  )}
                  {a.once_only && <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 text-xs">每次不提醒</span>}
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">优先级 {a.priority}</span>
                </div>
                <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{a.content || '（无内容）'}</div>
                <div className="text-xs text-gray-400 mt-1">创建于 {new Date(a.created_at).toLocaleString('zh-CN')}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                  title={a.active ? '下线' : '上线'}
                  onClick={() => toggleActive(a)}
                  disabled={busy}
                >
                  {a.active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="编辑" onClick={() => openEdit(a)} disabled={busy}>
                  <Pencil size={16} />
                </button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-red-500" title="删除" onClick={() => remove(a)} disabled={busy}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}>
          <div className="bg-white rounded-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink">{editing ? '编辑公告' : '新建公告'}</h3>
              <button className="text-gray-400 hover:text-ink" onClick={closeForm}>
                <X size={18} />
              </button>
            </div>
            <label className="text-sm text-gray-600">标题</label>
            <input
              className="input mt-1 w-full"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="如：系统升级通知"
            />
            <label className="text-sm text-gray-600 mt-3 block">内容</label>
            <textarea
              className="input mt-1 w-full h-28 resize-none"
              value={draft.content}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              placeholder="公告正文…"
            />
            <div className="flex items-center gap-4 mt-3">
              <div>
                <label className="text-sm text-gray-600">优先级</label>
                <input
                  type="number"
                  className="input mt-1 w-20"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 mt-5">
                <input
                  type="checkbox"
                  checked={draft.once_only}
                  onChange={(e) => setDraft({ ...draft, once_only: e.target.checked })}
                />
                每次不提醒（用户关闭后不再弹出）
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 mt-3">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              立即上线
            </label>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-ghost" onClick={closeForm}>
                取消
              </button>
              <button className="btn-primary inline-flex items-center gap-1" onClick={submit} disabled={busy}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />} 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
