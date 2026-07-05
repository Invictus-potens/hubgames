require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');

const { STEAM_API_KEY, STEAM_DOMAIN, SESSION_SECRET, PORT, NODE_ENV } = process.env;

if (!STEAM_API_KEY || !STEAM_DOMAIN) {
    throw new Error('STEAM_API_KEY e STEAM_DOMAIN precisam estar definidos no .env');
}

const isProd = NODE_ENV === 'production';
const baseUrl = isProd ? `https://${STEAM_DOMAIN}` : `http://localhost:${PORT || 3000}`;

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy(
    {
        returnURL: `${baseUrl}/auth/steam/return`,
        realm: baseUrl,
        apiKey: STEAM_API_KEY
    },
    (identifier, profile, done) => {
        process.nextTick(() => done(null, profile));
    }
));

const app = express();

app.use(session({
    secret: SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: isProd }
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => res.redirect('/hubgames.html'));

app.get('/auth/steam', passport.authenticate('steam'));

app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/' }),
    (req, res) => res.redirect('/')
);

app.get('/api/user', (req, res) => {
    res.json({ user: req.user || null });
});

app.get('/api/library', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'not_authenticated' });

    const steamId = req.user.id;
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    try {
        const steamRes = await fetch(url);
        const data = await steamRes.json();
        const games = (data.response?.games || []).map(g => ({
            appid: g.appid,
            name: g.name,
            playtime_forever: g.playtime_forever,
            playtime_2weeks: g.playtime_2weeks || 0
        }));
        res.json({ games });
    } catch (err) {
        res.status(502).json({ error: 'steam_api_error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.use(express.static(path.join(__dirname)));

const port = PORT || 3000;
app.listen(port, () => console.log(`GameVault rodando na porta ${port}`));
