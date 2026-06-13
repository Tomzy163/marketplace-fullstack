const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('../config/db');

function configurePassport() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return passport;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        passReqToCallback: true,
      },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value?.toLowerCase();
          if (!email) return done(null, false, { message: 'Google account has no email' });

          const requestedRole = req.query.state === 'seller' ? 'seller' : 'customer';
          const existing = await query('SELECT * FROM users WHERE email = $1', [email]);

          let user = existing.rows[0];
          if (user) {
            const linked = await query(
              `UPDATE users
                  SET oauth_provider = COALESCE(oauth_provider, 'google'),
                      oauth_id = COALESCE(oauth_id, $2)
                WHERE id = $1
                RETURNING *`,
              [user.id, profile.id],
            );
            user = linked.rows[0];
          } else {
            const created = await query(
              `INSERT INTO users (email, role, oauth_provider, oauth_id)
               VALUES ($1, $2, 'google', $3)
               RETURNING *`,
              [email, requestedRole, profile.id],
            );
            user = created.rows[0];
          }

          if (requestedRole === 'seller') {
            await query(
              `INSERT INTO sellers (user_id, store_name, slug, subscription_status)
               VALUES ($1, $2, $3, 'pending')
               ON CONFLICT (user_id) DO NOTHING`,
              [user.id, profile.displayName || email, email.split('@')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase()],
            );
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  return passport;
}

module.exports = configurePassport;
