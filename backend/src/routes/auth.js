const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

  // Check if email exists using Supabase
  const { data: existing, error: findError } = await db.supabase
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
    
  if (findError) {
    console.error('Register find error:', findError);
    return res.status(500).json({ error: 'Database error' });
  }
  
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  
  // Insert new user
  const { error: insertError } = await db.supabase
    .from('users')
    .insert({
      id,
      email: email.toLowerCase(),
      password_hash: hash,
      name
    });
    
  if (insertError) {
    console.error('Register insert error:', insertError);
    return res.status(500).json({ error: 'Failed to create user' });
  }

  const token = jwt.sign({ id, email, name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id, email, name } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  // Get user using Supabase
  const { data: user, error: findError } = await db.supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
    
  if (findError) {
    console.error('Login error:', findError);
    return res.status(500).json({ error: 'Database error' });
  }
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

module.exports = router;
