const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport'); 
const User = require('../models/User');

// --- SIGN UP ROUTE ---
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'An account with that email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(201).json({ 
      message: 'User created!', 
      token, 
      userId: user._id, 
      name: user.name 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// --- LOGIN ROUTE ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // UPDATED SAFETY CHECK: Handles both GitHub and Google users
    if (!user.password) {
        return res.status(400).json({ 
            error: 'This account uses Social Login. Please use the GitHub or Google button to sign in.' 
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.status(200).json({ 
      message: 'Login successful!', 
      token, 
      userId: user._id, 
      name: user.name 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// --- GITHUB OAUTH ROUTES ---
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: 'https://c-voice.vercel.app/auth.html', session: false }),
  (req, res) => {
    const userEncoded = encodeURIComponent(req.user.name);
    res.redirect(`https://c-voice.vercel.app/dashboard.html?id=${req.user._id}&name=${userEncoded}`);
  }
);

// --- GOOGLE OAUTH ROUTES ---
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: 'https://c-voice.vercel.app/auth.html', session: false }),
  (req, res) => {
    const userEncoded = encodeURIComponent(req.user.name);
    res.redirect(`https://c-voice.vercel.app/dashboard.html?id=${req.user._id}&name=${userEncoded}`);
  }
);

module.exports = router;