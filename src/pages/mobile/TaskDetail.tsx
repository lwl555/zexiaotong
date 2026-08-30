import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pin, Clock, MessageSquare, Flag, Share2, ChevronRight, CheckCircle2, Scale } from 'lucide-react'
import { useStore } from '../../store/store'
import { useMe } from '../../store/useMe'
import {
  PageHeader,
  HardCard,
  Tag,
  BtnPrimary,
  BtnGhost,
  INK,
  MUTED,
  ACCENT,
  HAIR,
  FONT,
  MONO,
  PAPER,
  btnGhost,
} from '../../components/Editorial'

const STATUS_TEXT: any = { open: '待接单', accepted: '已接单·待交付', doing: '进行中', review: '待验收', done: '已完成', arbitration: '仲裁中', closed: '已关闭' }
const STATUS_TONE: any = {
  open: 'accent', accepted: 'ink', doing: 'ink', review: 'ink', done: 'line', arbitration: 'ink', closed: 'line',
}

export default function TaskDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const task = useStore(s => s.tasks.find(t => t.id === id))
  const takeTask = useStore(s => s.takeTask)
  const deliverTask = useStore(s => s.deliverTask)
  const reviewPass = useStore(s => s.reviewPass)
  const reviewReject = useStore(s => s.reviewReject)
  const applyArbitration = useStore(s => s.applyArbitration)
  const [showDeliver, setShowDeliver] = useState(false)
  const [deliverText, setDeliverText] = useState('')

  if (!task) return <div style={{ padding: '40px 2px', textAlign: 'center', color: MUTED, fontFamily: FONT }}>任务不存在</div>

  const isPoster = task.poster_id === me.id
  const isWorker = task.accepted_id === me.id

  const renderAction = () => {
    if (task.status === 'open') {
      return isPoster
        ? <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED }}>等待同学接单中…</div>
        : <BtnPrimary onClick={() => takeTask(task.id)} style={{ width: '100%' }}>我要接单</BtnPrimary>
    }
    if (task.status === 'accepted') {
      return isPoster
        ? <div style={{ fontFamily: FONT, fontSize: 14, color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> {task.accepted_name} 已接单，等待其交付成果</div>
        : <BtnPrimary onClick={() => setShowDeliver(true)} style={{ width: '100%' }}>去交付成果</BtnPrimary>
    }
    if (task.status === 'doing') {
      return isWorker
        ? <BtnPrimary onClick={() => setShowDeliver(true)} style={{ width: '100%' }}>上传成果并交付</BtnPrimary>
        : <div style={{ fontFamily: FONT, fontSize: 14, color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}>进行中，等待对方交付</div>
    }
    if (task.status === 'review') {
      return isPoster
        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BtnPrimary onClick={() => reviewPass(task.id)} style={{ width: '100%' }}>验收通过并付款</BtnPrimary>
            <BtnGhost onClick={() => reviewReject(task.id)} style={{ width: '100%' }}>驳回，要求重做</BtnGhost>
          </div>
        : <div style={{ fontFamily: FONT, fontSize: 14, color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}>已交付，等待雇主验收</div>
    }
    if (task.status === 'arbitration') {
      return <div style={{ fontFamily: FONT, fontSize: 14, color: ACCENT, display: 'flex', alignItems: 'center', gap: 6 }}><Scale size={14} /> 仲裁处理中，等待管理员判定资金归属</div>
    }
    if (task.status === 'done') return <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> 任务已完成并结算</div>
    return <div style={{ fontFamily: FONT, fontSize: 14, color: MUTED }}>任务已关闭</div>
  }

  return (
    <div style={{ padding: '8px 2px 48px', maxWidth: 1200, margin: '0 auto', fontFamily: FONT }}>
      <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, color: MUTED, marginBottom: 8 }}>‹ 返回</button>

      {task.images[0] && (
        <img src={task.images[0]} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', border: `3px solid ${INK}`, borderRadius: 2, marginBottom: 14, display: 'block' }} />
      )}

      <PageHeader
        eyebrow="Task"
        title={task.title}
        desc={`${task.category} · ${task.deadline ? new Date(task.deadline).toLocaleString('zh-CN') : '无截止时间'}`}
        right={<Tag tone={STATUS_TONE[task.status] || 'line'}>{STATUS_TEXT[task.status]}</Tag>}
      />

      <HardCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: ACCENT }}>TASK</div>
          {task.top_until && <Tag tone="accent"><Pin size={11} /> 置顶</Tag>}
        </div>
        <h1 style={{ fontFamily: FONT, fontSize: 24, fontWeight: 800, color: INK, lineHeight: 1.2, margin: '8px 0 0' }}>{task.title}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Tag tone="ink">{task.category}</Tag>
          <Tag tone={STATUS_TONE[task.status] || 'line'}>{STATUS_TEXT[task.status]}</Tag>
          <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={12} /> {task.deadline ? new Date(task.deadline).toLocaleString('zh-CN') : ''}
          </span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 28, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', margin: '16px 0' }}>
          ¥{task.amount}
          <span style={{ fontFamily: FONT, fontSize: 12, color: MUTED, fontWeight: 400, marginLeft: 8 }}>
            {(() => { const c = useStore.getState().config; return c ? `平台抽佣 ${Math.round(c.commission_rate * 100)}%` : '' })()}
          </span>
        </div>
        <div style={{ fontFamily: FONT, fontSize: 14, color: INK, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{task.description}</div>
      </HardCard>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: `1px solid ${HAIR}`, borderRadius: 3, marginBottom: 16, background: PAPER }}>
        <img src={task.poster_avatar} alt="" style={{ width: 40, height: 40, borderRadius: '50%', border: `2px solid ${INK}` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{task.poster_name}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: MUTED, marginTop: 2 }}>发布者</div>
        </div>
        {task.accepted_id && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{task.accepted_name}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: MUTED, marginTop: 2 }}>接单者</div>
          </div>
        )}
      </div>

      {/* 操作区：粗黑边硬卡 */}
      <div style={{ border: `3px solid ${INK}`, borderRadius: 2, boxShadow: `5px 5px 0 ${INK}`, background: PAPER, padding: 18, marginBottom: 16 }}>
        {renderAction()}
        {!isPoster && task.status === 'review' && isWorker && (
          <BtnGhost onClick={() => applyArbitration(task.id, '对验收结果有异议')} style={{ width: '100%', marginTop: 8 }}>申请仲裁</BtnGhost>
        )}
      </div>

      {/* 底部功能 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12, marginTop: 8 }}>
        <button onClick={() => nav('/messages?peer=' + task.poster_id)} style={{ ...btnGhost({ padding: '8px 12px', fontSize: 13 }), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <MessageSquare size={18} /> <span style={{ fontFamily: FONT }}>联系发布者</span>
        </button>
        <button onClick={() => nav('/messages?peer=' + task.accepted_id)} style={{ ...btnGhost({ padding: '8px 12px', fontSize: 13 }), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <MessageSquare size={18} /> <span style={{ fontFamily: FONT }}>联系接单者</span>
        </button>
        <button onClick={() => nav('/')} style={{ ...btnGhost({ padding: '8px 12px', fontSize: 13 }), display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <Share2 size={18} /> <span style={{ fontFamily: FONT }}>分享</span>
        </button>
      </div>

      {showDeliver && (
        <div onClick={() => setShowDeliver(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.4)', zIndex: 40, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: PAPER, border: `3px solid ${INK}`, borderBottom: 'none', borderRadius: 2, padding: 18, width: '100%', boxSizing: 'border-box' }}>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 800, color: INK, marginBottom: 8 }}>交付成果说明</div>
            <textarea
              value={deliverText}
              onChange={e => setDeliverText(e.target.value)}
              placeholder="描述交付内容 / 上传链接…"
              style={{ width: '100%', height: 96, resize: 'none', border: `2px solid ${INK}`, borderRadius: 2, padding: 10, boxSizing: 'border-box', fontFamily: FONT, fontSize: 14, color: INK, outline: 'none' }}
            />
            <BtnPrimary onClick={() => { deliverTask(task.id, deliverText); setShowDeliver(false); setDeliverText('') }} style={{ width: '100%', marginTop: 12 }}>确认交付</BtnPrimary>
          </div>
        </div>
      )}
    </div>
  )
}
