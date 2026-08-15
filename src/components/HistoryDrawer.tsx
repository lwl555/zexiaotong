import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Conversation, QueryRecord, getConversations, getQueries, deleteConversation, deleteQuery, setPendingChannel } from '../lib/history'
import { renderReport, ThemeKey } from './Report'

const PAGE_LABEL: Record<string, string> = {
  'ai-search': 'AI百事通',
  'ai-tutor': '实时资讯台',
  'document-workshop': '文档工坊'
}
const CHANNEL_LABEL: Record<string, string> = {
  school: '查院校',
  'by-city': '按城市找工作',
  'by-company': '查公司',
  tutor: '择校评估',
  doc: '文档生成'
}

function useHistoryTick() {
  const [, force] = useReducer((x) => x + 1, 0)
  useEffect(() => {
    const h = () => force()
    window.addEventListener('zxt-history-change', h)
    return () => window.removeEventListener('zxt-history-change', h)
  }, [])
}

function fmt(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function HistoryDrawer({ open, onClose }: Props) {
  useHistoryTick()
  const nav = useNavigate()
  const [tab, setTab] = useState<'conv' | 'query'>('conv')
  const [detail, setDetail] = useState<QueryRecord | null>(null)

  if (!open) return null

  const convs = getConversations()
  const queries = getQueries()

  function openConversation(c: Conversation) {
    setPendingChannel(c.channel)
    nav('/' + c.pageKey)
    onClose()
  }

  return (
    <>
      <div className="drawer-mask" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <span>历史记录</span>
          <button className="drawer-x" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="drawer-tabs">
          <button className={tab === 'conv' ? 'active' : ''} onClick={() => setTab('conv')}>
            对话记录（{convs.length}）
          </button>
          <button className={tab === 'query' ? 'active' : ''} onClick={() => setTab('query')}>
            查询记录（{queries.length}）
          </button>
        </div>
        <div className="drawer-body">
          {tab === 'conv' && (
            convs.length === 0 ? (
              <div className="empty">还没有对话。在「AI百事通」里聊几句会自动保存，之后可在这里接着聊。</div>
            ) : (
              convs.map((c) => (
                <div key={c.id} className="hist-item" onClick={() => openConversation(c)}>
                  <div className="hist-main">
                    <div className="hist-title">{c.title || '未命名对话'}</div>
                    <div className="hist-sub">
                      {PAGE_LABEL[c.pageKey] || c.pageKey} · {CHANNEL_LABEL[c.channel] || ''} · {c.messages.length} 条 · {fmt(c.updatedAt)}
                    </div>
                  </div>
                  <span
                    className="hist-del"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteConversation(c.id)
                    }}
                  >
                    删除
                  </span>
                </div>
              ))
            )
          )}
          {tab === 'query' && (
            queries.length === 0 ? (
              <div className="empty">还没有查询。任何功能的提问都会在这里留痕，点开看完整答案。</div>
            ) : (
              queries.map((q) => (
                <div key={q.id} className="hist-item" onClick={() => setDetail(q)}>
                  <div className="hist-main">
                    <div className="hist-title">{q.question.slice(0, 42) || '（空查询）'}</div>
                    <div className="hist-sub">
                      {q.pageLabel} · {fmt(q.createdAt)}
                      {q.search?.ok ? ` · 已检索 ${q.search.count} 条` : ''}
                    </div>
                  </div>
                  <span
                    className="hist-del"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteQuery(q.id)
                    }}
                  >
                    删除
                  </span>
                </div>
              ))
            )
          )}
        </div>
      </aside>

      {detail && (
        <div className="drawer-mask" onClick={() => setDetail(null)}>
          <div className="query-detail" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <span>查询详情</span>
              <button className="drawer-x" onClick={() => setDetail(null)} aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="qd-meta">
              {detail.pageLabel} · {fmt(detail.createdAt)}
              {detail.search?.ok ? ` · 已联网检索 ${detail.search.count} 条（${detail.search.sources.join(' · ')}）` : ' · 模型知识作答'}
            </div>
            <div className="qd-block">
              <div className="qd-label">问</div>
              <div className="qd-q">{detail.question}</div>
            </div>
            {detail.image?.url && (
              <img className="qd-img" src={detail.image.url} alt={detail.image.title || '配图'} referrerPolicy="no-referrer" />
            )}
            <div className="qd-block">
              <div className="qd-label">答</div>
              <div className="qd-a">{renderReport(detail.answer, (detail.channel as ThemeKey) || 'school')}</div>
            </div>
            <div className="toolbar">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigator.clipboard.writeText(detail.answer).catch(() => {})}
              >
                复制答案
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
