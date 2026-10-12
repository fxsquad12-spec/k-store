
const SUPABASE_URL = "https://hneadiwnqskinuqvtpsi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kBRhCgc9DdVKrnc1iCUtMw_IKNiXzxN";

window.supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

