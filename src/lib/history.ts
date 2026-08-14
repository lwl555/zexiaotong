// 历史对话 & 查询记录——localStorage 持久化。
// 目的：刷新 / 切换页面不丢，支持「接着对话」与「查询记录点击看详情」。
import { SearchMeta, LinkInfo } from './agnes'

export interface StoredMsg {
  role: 'user' | 'ai'
  content: string
  image?: { url: string; title: string } | null
  /** 模型内部思考过程（仅供参考），可空 */
  reasoning?: string | null
  /** 真实场景图（最多 4 张），可空 */
  images?: { url: string; title: string }[] | null
  /** 检索到的真实参考链接（可点击打开 / 复制），可空 */
  links?: LinkInfo[] | null
}

export interface Conversation {
  id: string // 形如 `ai-search:school`
  pageKey: string // 来自哪个功能页：ai-search / ai-tutor / document-workshop
  channel: string // 子频道：school / by-city / by-company / tutor / doc
  title: string // 首条消息摘要
  messages: StoredMsg[]
  createdAt: number
  updatedAt: number
}

export interface QueryRecord {
  id: string
  pageKey: string
  channel: string
  pageLabel: string // 功能名（AI百事通 / 择校导师 / 文档工坊）
  question: string
  answer: string
  search?: SearchMeta | null
  image?: { url: string; title: string } | null
  images?: { url: string; title: string }[] | null
  /** 检索到的真实参考链接（可点击打开 / 复制），可空 */
  links?: LinkInfo[] | null
  /** 模型内部思考过程（仅供参考），可空 */
  reasoning?: string | null
  createdAt: number
}

const CONV_KEY = 'zxt_conv_v1'
const Q_KEY = 'zxt_query_v1'

function read<T>(k: string, fb: T): T {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as T) : fb
  } catch {
    return fb
  }
}
function write(k: string, v: any) {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* 隐私模式 / 配额满：静默降级 */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('zxt-history-change'))
}

let convs: Conversation[] | null = null
let queries: QueryRecord[] | null = null

export function getConversations(): Conversation[] {
  if (!convs) convs = read(CONV_KEY, [])
  // 仅返回有实际消息的会话
  return convs.filter((c) => c.messages && c.messages.length > 0)
}
export function getQueries(): QueryRecord[] {
  if (!queries) queries = read(Q_KEY, [])
  return queries
}
function saveConversations(list: Conversation[]) {
  convs = list
  write(CONV_KEY, list)
}
function saveQueries(list: QueryRecord[]) {
  queries = list
  write(Q_KEY, list)
}

export function getConversation(id: string): Conversation | undefined {
  const all = read<Conversation[]>(CONV_KEY, [])
  return all.find((c) => c.id === id)
}

export function upsertConversation(conv: Conversation) {
  const all = read<Conversation[]>(CONV_KEY, [])
  const i = all.findIndex((c) => c.id === conv.id)
  if (i >= 0) all[i] = conv
  else all.unshift(conv)
  saveConversations(all)
}

export function deleteConversation(id: string) {
  const all = read<Conversation[]>(CONV_KEY, [])
  saveConversations(all.filter((c) => c.id !== id))
}

export function addQuery(q: QueryRecord) {
  const all = read<QueryRecord[]>(Q_KEY, [])
  all.unshift(q)
  if (all.length > 200) all.length = 200 // 上限保护
  saveQueries(all)
}

export function deleteQuery(id: string) {
  const all = read<QueryRecord[]>(Q_KEY, [])
  saveQueries(all.filter((q) => q.id !== id))
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// 从「对话记录」点开某会话时，跨页面告诉 AISearch 应该切到哪个子频道。
let pendingChannel: string | null = null
export function setPendingChannel(c: string) {
  pendingChannel = c
}
export function consumePendingChannel(): string | null {
  const c = pendingChannel
  pendingChannel = null
  return c
}
