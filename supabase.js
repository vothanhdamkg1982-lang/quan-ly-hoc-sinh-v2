import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.8/+esm';

// BƯỚC 151.18.2: chẩn đoán số lần module Supabase thực sự được thực thi.
globalThis.__QLHS_SUPABASE_MODULE_RUNS__ = (globalThis.__QLHS_SUPABASE_MODULE_RUNS__ || 0) + 1;
console.warn('[151.18.2][SUPABASE MODULE RUN]', {
    count: globalThis.__QLHS_SUPABASE_MODULE_RUNS__,
    moduleUrl: import.meta.url,
    time: new Date().toISOString()
});

const SUPABASE_URL = 'https://ohmwphdeeldmlxuuknny.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_DgxnOXel9t7woqYrfInl5Q_YogcW--c';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});