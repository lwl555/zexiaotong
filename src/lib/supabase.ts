import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const anon = (import.meta as any).env?.VITE_SUPABASE_ANON as string | undefined

// 公共看板（避雷清单 / 搞钱项目）用匿名 key 直连。
// RLS 已配置为匿名可读写（见 supabase/migrations/0001_init.sql）。
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null
