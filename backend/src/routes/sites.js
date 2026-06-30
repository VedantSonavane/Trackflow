const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const auth = require('../middleware/auth');

function genApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'tf_';
  for (let i = 0; i < 32; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

// Hash for storage — SHA-256, not bcrypt (API keys are long-random, no need for bcrypt cost)
function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// List sites
router.get('/', auth, async (req, res) => {
  const { data: sites, error } = await db.supabase
    .from('sites')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('List sites error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  
  res.json(sites.map(s => ({ ...s, api_key: undefined, api_key_masked: s.api_key ? s.api_key.slice(0, 6) + '…' : null, config: s.config })));
});

// Create site
router.post('/', auth, async (req, res) => {
  const { name, domain, config = {} } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'Name and domain required' });

  // Normalize domain
  let cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();

  const id = uuidv4();
  const apiKey = genApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  
  const { error: insertError } = await db.supabase
    .from('sites')
    .insert({
      id,
      user_id: req.user.id,
      name,
      domain: cleanDomain,
      api_key: apiKey,         // plaintext — kept for collect.js lookup (hashed lookup is a Day 3 migration)
      api_key_hash: apiKeyHash,
      config
    });
    
  if (insertError) {
    console.error('Create site error:', insertError);
    return res.status(500).json({ error: 'Failed to create site' });
  }

  const { data: site, error: fetchError } = await db.supabase
    .from('sites')
    .select('*')
    .eq('id', id)
    .single();
    
  if (fetchError) {
    return res.status(500).json({ error: 'Failed to fetch site' });
  }
  
  res.json({ ...site, config: site.config });
});

// Get single site
router.get('/:id', auth, async (req, res) => {
  const { data: site, error } = await db.supabase
    .from('sites')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
    
  if (error) {
    console.error('Get site error:', error);
    return res.status(500).json({ error: 'Database error' });
  }
  
  if (!site) return res.status(404).json({ error: 'Not found' });
  res.json({ ...site, api_key: undefined, api_key_masked: site.api_key ? site.api_key.slice(0, 6) + '…' : null, config: site.config });
});

// Update site config
router.patch('/:id', auth, async (req, res) => {
  const { data: site, error: findError } = await db.supabase
    .from('sites')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
    
  if (findError || !site) return res.status(404).json({ error: 'Not found' });

  const { name, config } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (config) updates.config = config;

  if (Object.keys(updates).length === 0) return res.json({ ...site, config: site.config });

  const { error: updateError } = await db.supabase
    .from('sites')
    .update(updates)
    .eq('id', req.params.id);
    
  if (updateError) {
    return res.status(500).json({ error: 'Failed to update site' });
  }

  const { data: updated, error: fetchError } = await db.supabase
    .from('sites')
    .select('*')
    .eq('id', req.params.id)
    .single();
    
  res.json({ ...updated, api_key: undefined, api_key_masked: updated.api_key ? updated.api_key.slice(0, 6) + '…' : null, config: updated.config });
});

// Regenerate API key
router.post('/:id/regenerate-key', auth, async (req, res) => {
  const { data: site, error: findError } = await db.supabase
    .from('sites')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
    
  if (findError || !site) return res.status(404).json({ error: 'Not found' });

  const newKey = genApiKey();
  
  const { error: updateError } = await db.supabase
    .from('sites')
    .update({ api_key: newKey, api_key_hash: hashApiKey(newKey) })
    .eq('id', req.params.id);
    
  if (updateError) {
    return res.status(500).json({ error: 'Failed to regenerate key' });
  }
  
  res.json({ api_key: newKey });
});

// Delete site
router.delete('/:id', auth, async (req, res) => {
  const { data: site, error: findError } = await db.supabase
    .from('sites')
    .select('id')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .maybeSingle();
    
  if (findError || !site) return res.status(404).json({ error: 'Not found' });
  
  const { error: deleteError } = await db.supabase
    .from('sites')
    .delete()
    .eq('id', req.params.id);
    
  if (deleteError) {
    return res.status(500).json({ error: 'Failed to delete site' });
  }
  
  res.json({ ok: true });
});

module.exports = router;