const { createClient } = require('@supabase/supabase-js');

let supabase;
let initDone = false;

async function init() {
  if (initDone) return supabase;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error && error.code !== 'PGRST116') console.warn('Supabase init warning:', error.message);
  initDone = true;
  console.log('✓ Connected to Supabase (service role)');
  return supabase;
}

function persist() {}

module.exports = {
  init,
  persist,
  get supabase() { return supabase; },
};