import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { exportDocx } from '../lib/docx'
import {
  PageHeader,
  SectionLabel,
  HardCard,
  SoftCard,
  ListRow,
  Tag,
  BtnPrimary,
  BtnGhost,
  INK,
  MUTED,
  FAINT,
  ACCENT,
  HAIR,
  FONT,
  MONO,
} from '../components/Editorial'

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
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Money"
        title="搞钱项目"
        desc="兼职、副业、创业项目信息聚合，发现身边真实的搞钱机会。发布、管理一键操作。"
        right={
          <BtnGhost onClick={exportAll} style={!items.length ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            导出清单 Word
          </BtnGhost>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        {/* 发布面板：粗黑边硬卡 */}
        <HardCard style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionLabel label="发布项目" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>分类</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, background: '#fff', color: INK, outline: 'none' }}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>项目标题 *</label>
            <input
              value={form.title}
              placeholder="如：周末展会派单 200/天"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>项目说明 *</label>
            <textarea
              value={form.description}
              placeholder="做什么、要求、结算方式、真实情况…"
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>联系方式</label>
            <input
              value={form.contact}
              placeholder="微信 / 群 / 链接（选填）"
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none' }}
            />
          </div>
          <BtnPrimary onClick={add} disabled={saving || !form.title.trim() || !form.description.trim()} style={saving || !form.title.trim() || !form.description.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            {saving ? '发布中…' : '发布项目'}
          </BtnPrimary>
        </HardCard>

        {/* 列表区 */}
        <div>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: MUTED, fontSize: 14, padding: '40px 0' }}>
              <span className="animate-spin" style={{ width: 16, height: 16, border: `3px solid ${HAIR}`, borderTopColor: ACCENT, borderRadius: '50%', display: 'inline-block' }} />
              加载中…
            </div>
          ) : items.length === 0 ? (
            <SoftCard style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '48px 0' }}>
              暂无项目，左边发布第一个。
            </SoftCard>
          ) : (
            <div>
              <SectionLabel label={`项目列表 · ${items.length}`} />
              <div style={{ borderTop: `1px solid ${HAIR}` }}>
                {items.map((i, idx) => (
                  <ListRow key={i.id} style={{ alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: ACCENT, paddingTop: 2 }}>{String(idx + 1).padStart(2, '0')}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>{i.title}</span>
                          <Tag tone="accent">{i.category}</Tag>
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{i.description}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: FONT, fontSize: 12, color: FAINT }}>
                          <span>{i.contact || '无联系方式'}</span>
                          <span>·</span>
                          <span>{new Date(i.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      onClick={() => del(i.id)}
                      style={{ fontFamily: FONT, fontSize: 12, color: ACCENT, cursor: 'pointer', whiteSpace: 'nowrap', paddingTop: 2 }}
                    >
                      删除
                    </span>
                  </ListRow>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
