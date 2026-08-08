import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportDocx } from '../lib/docx'

interface Warning {
  id: string
  target_type: 'school' | 'company'
  title: string
  content: string
  tags: string
  created_at: string
}

export default function Warnings() {
  const [items, setItems] = useState<Warning[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ target_type: 'school', title: '', content: '', tags: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!supabase) return setLoading(false)
    const { data, error } = await supabase.from('warnings').select('*').order('created_at', { ascending: false })
    if (!error && data) setItems(data as Warning[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!form.title.trim() || !form.content.trim() || saving) return
    setSaving(true)
    const row = { ...form, tags: form.tags.trim() }
    if (supabase) {
      const { data, error } = await supabase.from('warnings').insert(row).select().single()
      if (!error && data) setItems((p) => [data as Warning, ...p])
    }
    setForm({ target_type: 'school', title: '', content: '', tags: '' })
    setSaving(false)
  }

  async function del(id: string) {
    if (supabase) await supabase.from('warnings').delete().eq('id', id)
    setItems((p) => p.filter((i) => i.id !== id))
  }

  async function exportAll() {
    if (!items.length) return
    const md = `# 避雷清单（共 ${items.length} 条）\n\n` +
      items.map((i) => `## ${i.title}（${i.target_type === 'school' ? '院校' : '公司'}${i.tags ? ' · ' + i.tags : ''}）\n${i.content}\n`).join('\n')
    await exportDocx('避雷清单', '避雷清单', md)
  }

  return (
    <>
      <div className="page-head">
        <h2>避雷清单</h2>
        <p>标记学校 / 公司的真实缺点，记录自己遇到的坑，随时导出 Word 备份。数据存于公共看板，人人可看可加。</p>
      </div>

      <div className="split">
        <div className="panel" style={{ padding: 18 }}>
          <div className="field">
            <label>类型</label>
            <select value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value as any })}>
              <option value="school">院校</option>
              <option value="company">公司</option>
            </select>
          </div>
          <div className="field">
            <label>标题 *</label>
            <input value={form.title} placeholder="如：某某大学 转专业极难" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>真实缺点 / 坑 *</label>
            <textarea value={form.content} placeholder="直说，别客气" onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <div className="field">
            <label>标签（逗号分隔）</label>
            <input value={form.tags} placeholder="如：宿舍,就业,管理" onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={add} disabled={saving || !form.title.trim() || !form.content.trim()}>
            {saving ? '保存中…' : '添加避雷'}
          </button>
        </div>

        <div>
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={exportAll} disabled={!items.length}>
              导出全部 Word
            </button>
          </div>
          {loading ? (
            <div className="loading"><span className="spinner" /> 加载中…</div>
          ) : items.length === 0 ? (
            <div className="empty">还没有避雷记录，左边加第一条。</div>
          ) : (
            <div className="list">
              {items.map((i) => (
                <div key={i.id} className="item">
                  <div className="top">
                    <h4>{i.title}</h4>
                    <span className="tag">{i.target_type === 'school' ? '院校' : '公司'}</span>
                  </div>
                  <div className="body">{i.content}</div>
                  <div className="foot">
                    <span>{i.tags || '无标签'}</span>
                    <span>·</span>
                    <span>{new Date(i.created_at).toLocaleDateString()}</span>
                    <span className="link-danger" onClick={() => del(i.id)}>删除</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
