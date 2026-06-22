import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// 기존 코드에서 hasSupabase라는 이름을 쓰는 컴포넌트도 있어서 별칭으로 같이 export
export const hasSupabase = hasSupabaseConfig;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
