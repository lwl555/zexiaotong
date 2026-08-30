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
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <PageHeader
        eyebrow="Warnings"
        title="避雷清单"
        desc="标记学校 / 公司的真实缺点，记录自己遇到的坑，随时导出 Word 备份。数据存于公共看板，人人可看可加。"
        right={
          <BtnGhost onClick={exportAll} style={!items.length ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
            导出全部 Word
          </BtnGhost>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: 22, alignItems: 'start' }}>
        {/* 发布面板：粗黑边硬卡 */}
        <HardCard style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionLabel label="添加避雷" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>类型</label>
            <select
              value={form.target_type}
              onChange={(e) => setForm({ ...form, target_type: e.target.value as any })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, background: '#fff', color: INK, outline: 'none' }}
            >
              <option value="school">院校</option>
              <option value="company">公司</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>标题 *</label>
            <input
              value={form.title}
              placeholder="如：某某大学 转专业极难"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>真实缺点 / 坑 *</label>
            <textarea
              value={form.content}
              placeholder="直说，别客气"
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: MUTED, textTransform: 'uppercase' }}>标签（逗号分隔）</label>
            <input
              value={form.tags}
              placeholder="如：宿舍,就业,管理"
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              style={{ border: `2px solid ${INK}`, borderRadius: 2, padding: '9px 10px', fontFamily: FONT, fontSize: 14, outline: 'none' }}
            />
          </div>
          <BtnPrimary onClick={add} disabled={saving || !form.title.trim() || !form.content.trim()} style={saving || !form.title.trim() || !form.content.trim() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
            {saving ? '保存中…' : '添加避雷'}
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
              还没有避雷记录，左边加第一条。
            </SoftCard>
          ) : (
            <div>
              <SectionLabel label={`避雷记录 · ${items.length}`} />
              <div style={{ borderTop: `1px solid ${HAIR}` }}>
                {items.map((i, idx) => (
                  <ListRow key={i.id} style={{ alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: ACCENT, paddingTop: 2 }}>{String(idx + 1).padStart(2, '0')}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: INK }}>{i.title}</span>
                          <Tag tone="accent">{i.target_type === 'school' ? '院校' : '公司'}</Tag>
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{i.content}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: FONT, fontSize: 12, color: FAINT }}>
                          <span>{i.tags || '无标签'}</span>
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
