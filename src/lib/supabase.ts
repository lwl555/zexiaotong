import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined
const anon = (import.meta as any).env?.VITE_SUPABASE_ANON as string | undefined

// 公共看板用匿名 key 直连
export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon) : null
