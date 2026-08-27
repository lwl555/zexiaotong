import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Trash2, FileDown, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { exportDocx } from '../../lib/docx'

interface Project {
  id: string
  title: string
  category: string
  description: string
  contact: string
  created_at: string
}

const CATS = ['兼职', '副业', '创业', '悬赏任务']

export default function MoneyMobile() {
  const nav = useNavigate()
  const [items, setItems] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [kw, setKw] = useState('')
  const [cat, setCat] = useState('全部')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', category: '兼职', description: '', contact: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!supabase) return setLoading(false)
    const { data, error } = await supabase.from('money_projects').select('*').order('created_at', { ascending: false })
    if (!error && data) setItems(data as Project[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function add() {
    if (!form.title.trim() || !form.description.trim() || saving) return
    setSaving(true)
    const row = { ...form }
    if (supabase) {
      const { data, error } = await supabase.from('money_projects').insert(row).select().single()
      if (!error && data) setItems((p) => [data as Project, ...p])
    }
    setForm({ title: '', category: '兼职', description: '', contact: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function del(id: string) {
    if (!confirm('确定删除该项目？')) return
    if (supabase) await supabase.from('money_projects').delete().eq('id', id)
    setItems((p) => p.filter((i) => i.id !== id))
  }

  async function exportAll() {
    if (!items.length) return
    const md =
      `# 搞钱项目清单（共 ${items.length} 条）\n\n` +
      items.map((i) => `## ${i.title}（${i.category}${i.contact ? ' · 联系：' + i.contact : ''}）\n${i.description}\n`).join('\n')
    await exportDocx('搞钱项目清单', '搞钱项目清单', md)
  }

  let list = items
  if (cat !== '全部') list = list.filter((i) => i.category === cat)
  if (kw) list = list.filter((i) => i.title.includes(kw) || i.description.includes(kw))

  return (
    <div className="px-3.5 pt-3 pb-12">
      {/* 页头：紧凑标题 + 发布 + 导出 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[17px] font-bold text-ink">搞钱项目</h1>
        <div className="flex items-center gap-2">
          <button onClick={exportAll} className="flex items-center gap-1 text-[13px] text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-full active:bg-gray-200">
            <FileDown size={14} /> 导出
          </button>
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1 text-[13px] text-brand-600 bg-brand-50 px-2.5 py-1.5 rounded-full active:bg-brand-100">
            <Plus size={15} /> 发布
          </button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-2.5">
        <Search size={17} className="text-gray-400" />
        <input className="bg-transparent outline-none text-[13px] flex-1" placeholder="搜索搞钱机会" value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>

      {/* 分类筛选 */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-3">
        {['全部', ...CATS].map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={'px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap ' + (cat === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
            {c}
          </button>
        ))}
      </div>

      {/* 发布表单（内联展开） */}
      {showForm && (
        <div className="card p-3.5 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[14px] font-semibold text-ink">发布搞钱项目</div>
            <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center text-gray-400 active:bg-gray-100 rounded-full">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap mb-2.5">
            {CATS.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, category: c })}
                className={'px-2.5 py-1 rounded-full text-[12px] ' + (form.category === c ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600')}>
                {c}
              </button>
            ))}
          </div>
          <input className="input mb-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="项目标题，如：周末展会派单 200/天" />
          <textarea className="input h-20 resize-none mb-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="做什么、要求、结算方式、真实情况…" />
          <input className="input mb-3" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="联系方式（微信 / 群 / 链接，选填）" />
          <button className="btn-primary w-full" onClick={add} disabled={saving || !form.title.trim() || !form.description.trim()}>
            {saving ? '发布中…' : '发布项目'}
          </button>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="text-center text-gray-400 text-[13px] py-16">加载中…</div>
      ) : list.length === 0 ? (
        <div className="text-center text-gray-400 text-[13px] py-16">暂无项目，点右上角「发布」第一个。</div>
      ) : (
        <div className="space-y-2.5">
          {list.map((i) => (
            <div key={i.id} className="card p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[15px] font-semibold text-ink leading-snug flex-1">{i.title}</div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 whitespace-nowrap">{i.category}</span>
              </div>
              <div className="text-[13px] text-gray-500 mt-1.5 line-clamp-3 whitespace-pre-wrap leading-relaxed">{i.description}</div>
              <div className="flex items-center justify-between mt-2.5 text-[11px] text-gray-400">
                <span className="truncate">{i.contact ? '联系：' + i.contact : '无联系方式'}</span>
                <span className="flex items-center gap-2 whitespace-nowrap">
                  <span>{new Date(i.created_at).toLocaleDateString()}</span>
                  <button onClick={() => del(i.id)} className="flex items-center gap-0.5 text-red-500 active:opacity-60">
                    <Trash2 size={13} /> 删除
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
