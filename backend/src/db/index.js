const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
let initDone = false;

async function init() {
  if (initDone) return supabase;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in environment');
  }
  
  supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test connection
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error && error.code !== 'PGRST116') {
    console.log('Supabase connection test:', error.message);
  }
  
  initDone = true;
  console.log('✓ Connected to Supabase PostgreSQL');
  return supabase;
}

// Helper to convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
function convertPlaceholders(sql) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

// Modern async API using Supabase
async function runAsync(sql, params = []) {
  const convertedSql = convertPlaceholders(sql);
  
  const { error } = await supabase.rpc('execute_sql', { 
    sql: convertedSql, 
    params 
  });
  
  if (error) {
    console.error('runAsync error:', error.message);
    throw error;
  }
}

async function getAsync(sql, params = []) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  const table = tableMatch ? tableMatch[1] : null;
  
  if (!table) {
    throw new Error('Could not determine table from SQL');
  }
  
  let query = supabase.from(table).select('*');
  
  // Extract WHERE conditions
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    
    // Handle id = $1 AND user_id = $2 conditions
    const eqMatches = whereClause.match(/(\w+)\s*=\s*\$\d+/g);
    if (eqMatches) {
      eqMatches.forEach((match, idx) => {
        const field = match.match(/(\w+)\s*=/)[1];
        if (params[idx] !== undefined) {
          query = query.eq(field, params[idx]);
        }
      });
    }
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error('getAsync error:', error.message, 'SQL:', sql);
    throw error;
  }
  
  return data;
}

async function allAsync(sql, params = []) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  const table = tableMatch ? tableMatch[1] : null;
  
  if (!table) {
    throw new Error('Could not determine table from SQL');
  }
  
  let query = supabase.from(table).select('*');
  
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    
    const conditions = whereClause.split(/\s+AND\s+/i);
    conditions.forEach((condition, idx) => {
      const eqMatch = condition.match(/(\w+)\s*=\s*\$?\d*/);
      if (eqMatch && params[idx] !== undefined) {
        query = query.eq(eqMatch[1], params[idx]);
      }
    });
  }
  
  const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
  const offsetMatch = sql.match(/OFFSET\s+(\d+)/i);
  if (limitMatch) query = query.limit(parseInt(limitMatch[1]));
  if (offsetMatch) query = query.range(parseInt(offsetMatch[1]), parseInt(offsetMatch[1]) + (limitMatch ? parseInt(limitMatch[1]) : 10));
  
  const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|OFFSET|$)/i);
  if (orderMatch) {
    const orderParts = orderMatch[1].split(',');
    orderParts.forEach(part => {
      const [column, direction] = part.trim().split(/\s+/);
      query = query.order(column, { ascending: !direction || direction.toUpperCase() !== 'DESC' });
    });
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('allAsync error:', error.message, 'SQL:', sql);
    throw error;
  }
  
  return data || [];
}

// Transaction helper
async function transaction(fn) {
  try {
    const result = await fn();
    return result;
  } catch (e) {
    throw e;
  }
}

// Persist function - no-op for Supabase
function persist() {}

module.exports = {
  init,
  persist,
  runAsync,
  getAsync,
  allAsync,
  transaction,
  get supabase() { return supabase; },
};
