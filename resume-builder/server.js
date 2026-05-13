require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GitHubStrategy = require('passport-github2').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('./models/User');

const app = express();

// --- Middleware ---
app.set('trust proxy', 1); // Required for Render to secure cookies

app.use(cors({
  origin: [
    'https://c-voice.vercel.app', 
    'http://localhost:3000',      
    'http://localhost:5000'       
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true 
}));

// Allows for large image uploads (Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serves your frontend files
app.use(express.static('public'));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected successfully!');
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
  });

// --- Passport & Session Configuration ---
app.use(session({
  secret: 'pro_resume_secret_key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// --- GitHub Strategy ---
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      let user = await User.findOne({ githubId: profile.id });

      if (!user) {
        user = new User({
          githubId: profile.id,
          name: profile.displayName || profile.username,
          email: profile.emails ? profile.emails[0].value : `${profile.username}@github.com`,
        });

        await user.save();
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

// --- Google Strategy ---
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // 1. First try to find by googleId
      let user = await User.findOne({ googleId: profile.id });

      // 2. If not found, try to find by email
      if (!user) {
        user = await User.findOne({ email: profile.emails[0].value });
      }

      // 3. If still no user, create a new one
      if (!user) {
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
        });

        await user.save();
      } else if (!user.googleId) {
        // If user existed by email but didn't have googleId linked yet
        user.googleId = profile.id;
        await user.save();
      }

      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// --- API Routes ---
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const aiRoutes = require('./routes/ai');

// --- Basic Test Route ---
app.get('/api/status', (req, res) => {
  res.json({ message: 'Server is up and running!' });
});

// Specific routes first
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);

// General API routes last
app.use('/api', apiRoutes);

// --- Start the Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 Open on mobile: http://YOUR-LAPTOP-IP:${PORT}`);
});