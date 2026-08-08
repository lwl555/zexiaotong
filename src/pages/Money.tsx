import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportDocx } from '../lib/docx'

interface Project {
  id: string
  title: string
  category: string
  description: string
  contact: string
  created_at: string
}

const CATS = ['兼职', '副业', '创业', '悬赏任务']

export default function Money() {
  const [items, setItems] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
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
    setSaving(false)
  }

  async function del(id: string) {
    if (supabase) await supabase.from('money_projects').delete().eq('id', id)
    setItems((p) => p.filter((i) => i.id !== id))
  }

  async function exportAll() {
    if (!items.length) return
    const md = `# 搞钱项目清单（共 ${items.length} 条）\n\n` +
      items.map((i) => `## ${i.title}（${i.category}${i.contact ? ' · 联系：' + i.contact : ''}）\n${i.description}\n`).join('\n')
    await exportDocx('搞钱项目清单', '搞钱项目清单', md)
  }

  return (
    <>
      <div className="page-head">
        <h2>搞钱项目</h2>
        <p>兼职、副业、创业项目信息聚合，发现身边真实的搞钱机会。发布、管理一键操作。</p>
      </div>

      <div className="split">
        <div className="panel" style={{ padding: 18 }}>
          <div className="field">
            <label>分类</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>项目标题 *</label>
            <input value={form.title} placeholder="如：周末展会派单 200/天" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>项目说明 *</label>
            <textarea value={form.description} placeholder="做什么、要求、结算方式、真实情况…" onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>联系方式</label>
            <input value={form.contact} placeholder="微信 / 群 / 链接（选填）" onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={add} disabled={saving || !form.title.trim() || !form.description.trim()}>
            {saving ? '发布中…' : '发布项目'}
          </button>
        </div>

        <div>
          <div className="toolbar" style={{ marginBottom: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={exportAll} disabled={!items.length}>
              导出清单 Word
            </button>
          </div>
          {loading ? (
            <div className="loading"><span className="spinner" /> 加载中…</div>
          ) : items.length === 0 ? (
            <div className="empty">暂无项目，左边发布第一个。</div>
          ) : (
            <div className="list">
              {items.map((i) => (
                <div key={i.id} className="item">
                  <div className="top">
                    <h4>{i.title}</h4>
                    <span className="tag">{i.category}</span>
                  </div>
                  <div className="body">{i.description}</div>
                  <div className="foot">
                    <span>{i.contact || '无联系方式'}</span>
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
