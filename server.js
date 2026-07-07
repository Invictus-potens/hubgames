require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { JSDOM } = require('jsdom');

const { STEAM_API_KEY, STEAM_DOMAIN, SESSION_SECRET, PORT, NODE_ENV, DATABASE_URL, RAWG_API_KEY } = process.env;

if (!STEAM_API_KEY || !STEAM_DOMAIN) {
    throw new Error('STEAM_API_KEY e STEAM_DOMAIN precisam estar definidos no .env');
}
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL precisa estar definido no .env');
}

const isProd = NODE_ENV === 'production';
const baseUrl = isProd ? `https://${STEAM_DOMAIN}` : `http://localhost:${PORT || 3422}`;

const prisma = new PrismaClient();
const pgPool = new Pool({ connectionString: DATABASE_URL });

function steamAvatar(profile) {
    return profile.photos?.[2]?.value || profile.photos?.[0]?.value || null;
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy(
    {
        returnURL: `${baseUrl}/auth/steam/return`,
        realm: baseUrl,
        apiKey: STEAM_API_KEY
    },
    async (identifier, profile, done) => {
        try {
            await prisma.user.upsert({
                where: { steamId: profile.id },
                update: { displayName: profile.displayName, avatar: steamAvatar(profile) },
                create: { steamId: profile.id, displayName: profile.displayName, avatar: steamAvatar(profile) }
            });
            done(null, profile);
        } catch (err) {
            done(err);
        }
    }
));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

app.use(session({
    proxy: true,
    store: new pgSession({ pool: pgPool, createTableIfMissing: true }),
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

function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
    next();
}

async function getDbUser(req) {
    return prisma.user.findUnique({ where: { steamId: req.user.id } });
}

app.get('/api/games', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const games = await prisma.game.findMany({ where: { userId: dbUser.id }, orderBy: { createdAt: 'asc' } });
    res.json(games);
});

app.get('/api/stats', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const games = await prisma.game.findMany({ where: { userId: dbUser.id } });

    const totalMinutes = games.reduce((sum, g) => sum + (g.playtimeForever || 0), 0);
    const gamesCompleted = games.filter(g => g.completed).length;
    const gamesPlaying = games.filter(g => g.category === 'playing').length;
    const gamesBacklog = games.filter(g => g.category === 'backlog').length;

    const recentActivity = games
        .filter(g => (g.playtime2Weeks || 0) > 0)
        .sort((a, b) => b.playtime2Weeks - a.playtime2Weeks)
        .slice(0, 5)
        .map(g => ({ title: g.title, cover: g.cover, hours2Weeks: Math.round((g.playtime2Weeks / 60) * 10) / 10 }));

    res.json({
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalGames: games.length,
        gamesCompleted,
        gamesPlaying,
        gamesBacklog,
        recentActivity
    });
});

app.post('/api/games', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const { title, category, date, notes, favorite, completed } = req.body;
    const game = await prisma.game.create({
        data: {
            userId: dbUser.id,
            title,
            category: category || 'new',
            date: date || null,
            notes: notes || null,
            favorite: !!favorite,
            completed: !!completed
        }
    });
    res.status(201).json(game);
});

app.put('/api/games/:id', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);
    const { title, category, date, notes, favorite, completed } = req.body;

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing || existing.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });

    const game = await prisma.game.update({
        where: { id },
        data: { title, category, date: date || null, notes: notes || null, favorite: !!favorite, completed: !!completed }
    });
    res.json(game);
});

app.patch('/api/games/:id/favorite', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing || existing.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });

    const game = await prisma.game.update({ where: { id }, data: { favorite: !existing.favorite } });
    res.json(game);
});

app.patch('/api/games/:id/news-priority', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing || existing.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });

    const game = await prisma.game.update({ where: { id }, data: { newsPriority: !existing.newsPriority } });
    res.json(game);
});

app.delete('/api/games/:id', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);

    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing || existing.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });

    await prisma.game.delete({ where: { id } });
    res.status(204).end();
});

app.get('/api/games/:id/metadata', requireAuth, async (req, res) => {
    if (!RAWG_API_KEY) return res.status(501).json({ error: 'rawg_not_configured' });

    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game || game.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });

    if (game.genre || game.synopsis || game.screenshots.length > 0) {
        return res.json(game);
    }

    try {
        const searchUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${encodeURIComponent(game.title)}&page_size=1`;
        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        const match = searchData.results?.[0];

        if (!match) return res.status(404).json({ error: 'no_metadata_found' });

        const detailUrl = `https://api.rawg.io/api/games/${match.id}?key=${RAWG_API_KEY}`;
        const detailRes = await fetch(detailUrl);
        const detail = await detailRes.json();

        const screenshotsUrl = `https://api.rawg.io/api/games/${match.id}/screenshots?key=${RAWG_API_KEY}`;
        const screenshotsRes = await fetch(screenshotsUrl);
        const screenshotsData = await screenshotsRes.json();
        const screenshots = (screenshotsData.results || []).slice(0, 6).map(s => s.image);

        const updated = await prisma.game.update({
            where: { id },
            data: {
                genre: (detail.genres || []).map(g => g.name).join(', ') || null,
                synopsis: detail.description_raw || null,
                metacritic: detail.metacritic || null,
                screenshots
            }
        });

        res.json(updated);
    } catch (err) {
        res.status(502).json({ error: 'rawg_api_error' });
    }
});

app.get('/api/library', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const steamId = req.user.id;
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`;

    try {
        const steamRes = await fetch(url);
        const data = await steamRes.json();
        const steamGames = data.response?.games || [];

        // Lotes pequenos para não estourar o pool de conexões do Prisma com bibliotecas grandes
        const CHUNK_SIZE = 20;
        const games = [];
        for (let i = 0; i < steamGames.length; i += CHUNK_SIZE) {
            const chunk = steamGames.slice(i, i + CHUNK_SIZE);
            const results = await Promise.all(chunk.map(g => prisma.game.upsert({
                where: { userId_appid: { userId: dbUser.id, appid: g.appid } },
                update: {
                    playtimeForever: g.playtime_forever,
                    playtime2Weeks: g.playtime_2weeks || 0
                },
                create: {
                    userId: dbUser.id,
                    title: g.name,
                    category: (g.playtime_2weeks || 0) > 0 ? 'playing' : 'played',
                    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
                    appid: g.appid,
                    playtimeForever: g.playtime_forever,
                    playtime2Weeks: g.playtime_2weeks || 0
                }
            })));
            games.push(...results);
        }

        res.json({ games });
    } catch (err) {
        res.status(502).json({ error: 'steam_api_error' });
    }
});

const achievementSchemaCache = new Map();

async function getGameSchema(appid) {
    if (achievementSchemaCache.has(appid)) return achievementSchemaCache.get(appid);

    const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${STEAM_API_KEY}&appid=${appid}&l=portuguese`;
    const res = await fetch(url);
    const data = await res.json();
    const schemaAchievements = data.game?.availableGameStats?.achievements || [];

    const schema = new Map(schemaAchievements.map(a => [a.name, {
        name: a.displayName,
        description: a.description || '',
        icon: a.icon,
        iconGray: a.icongray
    }]));

    achievementSchemaCache.set(appid, schema);
    return schema;
}

app.get('/api/games/:id/achievements', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    const id = Number(req.params.id);

    const game = await prisma.game.findUnique({ where: { id } });
    if (!game || game.userId !== dbUser.id) return res.status(404).json({ error: 'not_found' });
    if (!game.appid) return res.status(400).json({ error: 'no_appid' });

    try {
        const steamId = req.user.id;
        const playerUrl = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${STEAM_API_KEY}&steamid=${steamId}&appid=${game.appid}&l=portuguese`;
        const playerRes = await fetch(playerUrl);
        const playerData = await playerRes.json();

        if (playerData.playerstats?.success === false) {
            return res.status(404).json({ error: playerData.playerstats?.error || 'no_achievements' });
        }

        const playerAchievements = playerData.playerstats?.achievements || [];
        const schema = await getGameSchema(game.appid);

        const achievements = playerAchievements.map(a => {
            const info = schema.get(a.apiname) || {};
            return {
                apiname: a.apiname,
                name: info.name || a.apiname,
                description: info.description || '',
                icon: a.achieved ? info.icon : (info.iconGray || info.icon),
                achieved: !!a.achieved,
                unlockTime: a.unlocktime || null
            };
        }).sort((a, b) => Number(b.achieved) - Number(a.achieved));

        const unlocked = achievements.filter(a => a.achieved).length;
        const total = achievements.length;

        // 100% de conquistas marca como completado automaticamente (nunca desmarca)
        let completed = game.completed;
        if (total > 0 && unlocked === total && !game.completed) {
            await prisma.game.update({ where: { id }, data: { completed: true } });
            completed = true;
        }

        res.json({ achievements, unlocked, total, completed });
    } catch (err) {
        res.status(502).json({ error: 'steam_api_error' });
    }
});

const NEWS_CACHE_TTL = 30 * 60 * 1000;
const newsCache = new Map();

const STEAM_CLAN_IMAGE_BASE = 'https://clan.cloudflare.steamstatic.com/images/';

// A API da Steam mistura BBCode e HTML no corpo das notícias; convertemos o BBCode
// suportado para HTML antes de sanitizar, para preservar imagens/links/formatação.
function bbcodeToHtml(raw) {
    let text = raw || '';
    text = text.replace(/\{STEAM_CLAN_IMAGE\}/gi, STEAM_CLAN_IMAGE_BASE);
    text = text.replace(/\{STEAM_CLAN_LOC_IMAGE\}/gi, STEAM_CLAN_IMAGE_BASE);
    text = text.replace(/\[img\](.*?)\[\/img\]/gis, '<img src="$1">');
    text = text.replace(/\[url=(.*?)\](.*?)\[\/url\]/gis, '<a href="$1">$2</a>');
    text = text.replace(/\[b\](.*?)\[\/b\]/gis, '<b>$1</b>');
    text = text.replace(/\[i\](.*?)\[\/i\]/gis, '<i>$1</i>');
    text = text.replace(/\[u\](.*?)\[\/u\]/gis, '<u>$1</u>');
    text = text.replace(/\[strike\](.*?)\[\/strike\]/gis, '<s>$1</s>');
    text = text.replace(/\[h1\](.*?)\[\/h1\]/gis, '<h3>$1</h3>');
    text = text.replace(/\[list\]/gi, '<ul>').replace(/\[\/list\]/gi, '</ul>');
    text = text.replace(/\[\*\]/gi, '<li>');
    text = text.replace(/\[hr\]\[\/hr\]|\[hr\]/gi, '<hr>');
    text = text.replace(/\[previewyoutube=([^;\]]+)[^\]]*\]\[\/previewyoutube\]/gi,
        '<a href="https://www.youtube.com/watch?v=$1">Ver vídeo no YouTube ↗</a>');
    // remove qualquer tag BBCode remanescente que não tratamos
    text = text.replace(/\[\/?[a-z0-9=_;:\-\s"'.%]*\]/gi, '');
    return text;
}

const NEWS_ALLOWED_TAGS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'HR', 'A', 'IMG', 'DIV', 'SPAN']);

function sanitizeNewsHtml(html) {
    const dom = new JSDOM(`<div id="root">${html}</div>`);
    const document = dom.window.document;
    const root = document.getElementById('root');

    // Guarda href/src originais antes que a limpeza de atributos os apague
    const hrefs = new Map();
    const srcs = new Map();
    root.querySelectorAll('a[href]').forEach(a => hrefs.set(a, a.getAttribute('href')));
    root.querySelectorAll('img[src]').forEach(img => srcs.set(img, img.getAttribute('src')));

    const walk = (node) => {
        [...node.childNodes].forEach(child => {
            if (child.nodeType === 8) { // comment
                node.removeChild(child);
                return;
            }
            if (child.nodeType !== 1) return; // texto: mantém

            if (!NEWS_ALLOWED_TAGS.has(child.tagName)) {
                // tag não permitida: descarta a tag mas preserva o conteúdo
                while (child.firstChild) node.insertBefore(child.firstChild, child);
                node.removeChild(child);
                return;
            }

            if (child.tagName === 'A' && hrefs.has(child)) {
                const href = hrefs.get(child);
                [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
                if (/^https?:\/\//i.test(href)) {
                    child.setAttribute('href', href);
                    child.setAttribute('target', '_blank');
                    child.setAttribute('rel', 'noopener noreferrer');
                    child.classList.add('text-red-400', 'hover:text-red-300', 'underline');
                }
            } else if (child.tagName === 'IMG' && srcs.has(child)) {
                const src = srcs.get(child);
                [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
                if (/^https?:\/\//i.test(src)) {
                    child.setAttribute('src', src);
                    child.setAttribute('loading', 'lazy');
                    child.classList.add('rounded-lg', 'my-3', 'max-w-full');
                } else {
                    node.removeChild(child);
                    return;
                }
            } else {
                [...child.attributes].forEach(attr => child.removeAttribute(attr.name));
            }

            walk(child);
        });
    };

    walk(root);

    return root.innerHTML.trim();
}

async function getAppNews(appid) {
    const cached = newsCache.get(appid);
    if (cached && Date.now() - cached.fetchedAt < NEWS_CACHE_TTL) return cached.items;

    // maxlength=0 traz o texto completo para o modal de notícia
    const url = `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${appid}&count=3&maxlength=0&format=json`;
    const res = await fetch(url);
    const data = await res.json();

    const items = (data.appnews?.newsitems || []).map(n => ({
        gid: n.gid,
        title: n.title,
        url: /^https?:\/\//.test(n.url || '') ? n.url : null,
        // texto puro para o preview do card
        contents: (n.contents || '').replace(/\[[^\]]*\]/g, '').replace(/<[^>]*>/g, '').trim(),
        // HTML sanitizado (com imagens/links) para o modal
        contentsHtml: sanitizeNewsHtml(bbcodeToHtml(n.contents || '')),
        feedlabel: n.feedlabel,
        date: n.date
    }));

    newsCache.set(appid, { items, fetchedAt: Date.now() });
    return items;
}

app.get('/api/news', requireAuth, async (req, res) => {
    const dbUser = await getDbUser(req);
    // Prioritários sempre entram; sobrando vaga, completa com Jogando/Backlog/favoritos
    const priorityGames = await prisma.game.findMany({
        where: { userId: dbUser.id, appid: { not: null }, newsPriority: true },
        take: 15
    });

    const remaining = 15 - priorityGames.length;
    const otherGames = remaining > 0
        ? await prisma.game.findMany({
            where: {
                userId: dbUser.id,
                appid: { not: null },
                newsPriority: false,
                OR: [{ category: 'playing' }, { category: 'backlog' }, { favorite: true }]
            },
            take: remaining
        })
        : [];

    const games = [...priorityGames, ...otherGames];

    try {
        const perGame = await Promise.all(games.map(async g => {
            try {
                const items = await getAppNews(g.appid);
                return items.map(n => ({ ...n, gameTitle: g.title, cover: g.cover, appid: g.appid }));
            } catch (err) {
                return [];
            }
        }));

        const news = perGame.flat().sort((a, b) => b.date - a.date).slice(0, 30);
        res.json({ news });
    } catch (err) {
        res.status(502).json({ error: 'steam_news_error' });
    }
});

app.post('/api/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.use(express.static(path.join(__dirname)));

const port = PORT || 3422;
app.listen(port, () => console.log(`GameVault rodando na porta ${port}`));
