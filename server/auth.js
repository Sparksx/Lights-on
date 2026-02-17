'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const { findOrCreateUser } = require('./db');

// --- Serialize / Deserialize ---
passport.serializeUser((user, done) => {
  done(null, { id: user.id, display_name: user.display_name, avatar_url: user.avatar_url });
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// --- Google OAuth2 ---
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateUser('google', {
            id: profile.id,
            displayName: profile.displayName,
            avatar: profile.photos?.[0]?.value || null,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      },
    ),
  );
  console.log('[auth] Google strategy registered');
} else {
  console.log('[auth] Google strategy skipped (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)');
}

// --- Discord OAuth2 ---
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        callbackURL: '/auth/discord/callback',
        scope: ['identify'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const avatarURL = profile.avatar
            ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
            : null;
          const user = await findOrCreateUser('discord', {
            id: profile.id,
            displayName: profile.username,
            avatar: avatarURL,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      },
    ),
  );
  console.log('[auth] Discord strategy registered');
} else {
  console.log('[auth] Discord strategy skipped (missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET)');
}

// --- Auth routes ---
function setupAuthRoutes(app) {
  // Google
  app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));
  app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) =>
    res.redirect('/'),
  );

  // Discord
  app.get('/auth/discord', passport.authenticate('discord'));
  app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) =>
    res.redirect('/'),
  );

  // Current user
  app.get('/auth/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({
        id: req.user.id,
        displayName: req.user.display_name,
        avatar: req.user.avatar_url,
      });
    } else {
      res.json(null);
    }
  });

  // Logout
  app.post('/auth/logout', (req, res) => {
    req.logout(() => {
      res.json({ ok: true });
    });
  });
}

module.exports = { passport, setupAuthRoutes };
