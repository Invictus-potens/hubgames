// ============================
// Hub Game
// ============================

// --- ESTADO (CORE) ---
let games = [];

async function loadGames() {
    const res = await fetch('/api/games');
    if (res.ok) {
        games = await res.json();
    }
    renderGames();
    renderCalendar();
    loadStats();
}

async function loadStats() {
    const res = await fetch('/api/stats');
    if (!res.ok) return;
    const stats = await res.json();

    document.getElementById('statTotalHours').textContent = `${stats.totalHours}h`;
    document.getElementById('statTotalGames').textContent = stats.totalGames;
    document.getElementById('statCompleted').textContent = stats.gamesCompleted;
    document.getElementById('statPlaying').textContent = stats.gamesPlaying;
    document.getElementById('statBacklog').textContent = stats.gamesBacklog ?? 0;

    const recentActivity = document.getElementById('recentActivity');

    if (stats.recentActivity.length === 0) {
        recentActivity.innerHTML = '';
        return;
    }

    const maxHours = Math.max(...stats.recentActivity.map(a => a.hours2Weeks));

    const bars = stats.recentActivity.map(a => {
        const barWidth = maxHours > 0 ? Math.max(4, Math.round((a.hours2Weeks / maxHours) * 100)) : 0;
        return `
            <div class="flex items-center gap-3">
                <span class="text-xs text-gray-400 w-32 truncate shrink-0">${a.title}</span>
                <div class="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-red-600 to-purple-600 rounded-full" style="width: ${barWidth}%"></div>
                </div>
                <span class="text-xs text-gray-400 w-16 text-right shrink-0">${a.hours2Weeks}h</span>
            </div>
        `;
    });

    recentActivity.innerHTML = bars.join('');
}

const gameForm = document.getElementById('gameForm');
const gamesGrid = document.getElementById('gamesGrid');
const releaseCalendar = document.getElementById('releaseCalendar');

// --- FUNÇÕES DE RENDERIZAÇÃO ---

let currentFilter = 'all';

const PAGE_SIZE = 60;
let visibleCount = PAGE_SIZE;

let searchDebounce = null;
function onSearchInput() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => renderGames(currentFilter), 250);
}

function populateFilterOptions() {
    const genreFilter = document.getElementById('genreFilter');
    const yearFilter = document.getElementById('yearFilter');
    if (!genreFilter || !yearFilter) return;

    const genres = new Set();
    games.forEach(g => (g.genre || '').split(',').map(x => x.trim()).filter(Boolean).forEach(x => genres.add(x)));
    const selectedGenre = genreFilter.value;
    genreFilter.innerHTML = '<option value="">Todos os gêneros</option>' +
        [...genres].sort().map(g => `<option value="${g}">${g}</option>`).join('');
    genreFilter.value = selectedGenre;

    const years = new Set();
    games.forEach(g => { if (g.date) years.add(g.date.slice(0, 4)); });
    const selectedYear = yearFilter.value;
    yearFilter.innerHTML = '<option value="">Todos os anos</option>' +
        [...years].sort().reverse().map(y => `<option value="${y}">${y}</option>`).join('');
    yearFilter.value = selectedYear;
}

function renderGames(filter = 'all', keepPage = false) {
    currentFilter = filter;
    if (!keepPage) visibleCount = PAGE_SIZE;
    populateFilterOptions();
    gamesGrid.innerHTML = '';

    const searchText = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
    const genreValue = document.getElementById('genreFilter')?.value || '';
    const yearValue = document.getElementById('yearFilter')?.value || '';

    const filtered = games.filter(g => {
        if (filter === 'all' && g.category === 'release') return false;
        if (filter === 'fav' && !g.favorite) return false;
        if (filter === 'completed' && !g.completed) return false;
        if (filter !== 'all' && filter !== 'fav' && filter !== 'completed' && g.category !== filter) return false;
        if (searchText && !g.title.toLowerCase().includes(searchText)) return false;
        if (genreValue && !(g.genre || '').split(',').map(x => x.trim()).includes(genreValue)) return false;
        if (yearValue && (!g.date || !g.date.startsWith(yearValue))) return false;
        return true;
    });

    if (filtered.length === 0) {
        gamesGrid.innerHTML = `<p class="col-span-full text-gray-500 text-center py-10">Nenhum jogo encontrado nesta categoria.</p>`;
        return;
    }

    const cards = filtered.slice(0, visibleCount).map(game => {
        const categoryLabels = { playing: 'Jogando', played: 'Já Joguei', backlog: 'Backlog', old: 'Antigo', new: 'Novo', release: 'Calendário' };
        const playtimeBadge = game.playtimeForever != null
            ? `<p class="text-xs text-gray-500 mb-2">${(game.playtimeForever / 60).toFixed(1)}h jogadas${game.playtime2Weeks ? ` · ${(game.playtime2Weeks / 60).toFixed(1)}h nas últimas 2 semanas` : ''}</p>`
            : '';
        const card = `
            <div class="glass p-4 rounded-xl group relative gx-card border border-gray-800 cursor-default">
                <img src="${game.cover || 'https://via.placeholder.com/300x400?text=Sem+Capa'}" loading="lazy" class="w-full h-48 object-cover rounded-lg mb-4 shadow-lg">
                ${game.favorite ? '<span class="absolute top-6 right-6 text-yellow-400 text-xl drop-shadow-lg">★</span>' : ''}
                <h4 class="font-bold text-lg mb-1 truncate">${game.completed ? '<span class="text-green-400" title="Completado">✔</span> ' : ''}${game.title}</h4>
                <p class="text-xs text-gray-500 mb-3 uppercase tracking-widest">${categoryLabels[game.category] || game.category}</p>
                ${playtimeBadge}
                ${game.genre ? `<p class="text-xs text-gray-500 mb-2">${game.genre}${game.metacritic ? ` · ★ ${game.metacritic}` : ''}</p>` : ''}
                <p class="text-sm text-gray-400 line-clamp-2 italic">"${game.notes || 'Sem notas...'}"</p>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="openMetadata(${game.id})" class="btn-icon bg-green-500/10 hover:bg-green-500/25" title="Detalhes">
                        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </button>
                    ${game.appid ? `
                    <button onclick="openAchievements(${game.id})" class="btn-icon bg-purple-500/10 hover:bg-purple-500/25" title="Conquistas">
                        <svg class="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a3 3 0 013-3v0a3 3 0 013 3v6m-9 0h9M5 7h14M7 3h10l-1 4H8L7 3z"></path></svg>
                    </button>` : ''}
                    <button onclick="editGame(${game.id})" class="btn-icon bg-blue-500/10 hover:bg-blue-500/25" title="Editar">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    ${game.appid ? `
                    <button onclick="toggleNewsPriority(${game.id})" class="btn-icon ${game.newsPriority ? 'bg-orange-500/20 hover:bg-orange-500/30' : 'bg-gray-500/10 hover:bg-orange-500/15'}" title="Prioridade nas notícias">
                        <svg class="w-4 h-4 ${game.newsPriority ? 'text-orange-400' : 'text-gray-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                    </button>` : ''}
                    <button onclick="toggleFavorite(${game.id})" class="btn-icon ${game.favorite ? 'bg-yellow-500/20 hover:bg-yellow-500/30' : 'bg-gray-500/10 hover:bg-yellow-500/15'}" title="Favoritar">
                        <svg class="w-4 h-4 ${game.favorite ? 'text-yellow-400' : 'text-gray-500'}" fill="${game.favorite ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                    </button>
                    <button onclick="confirmDelete(${game.id})" class="btn-icon bg-red-500/10 hover:bg-red-500/25" title="Remover">
                        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;
        return card;
    });

    const showMoreBtn = filtered.length > visibleCount
        ? `<div class="col-span-full text-center py-4">
                <button onclick="showMoreGames()" class="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-6 py-2.5 rounded-lg font-semibold transition-all">
                    Mostrar mais (${Math.min(visibleCount, filtered.length)} de ${filtered.length})
                </button>
           </div>`
        : '';

    gamesGrid.innerHTML = cards.join('') + showMoreBtn;
}

function showMoreGames() {
    visibleCount += PAGE_SIZE;
    renderGames(currentFilter, true);
}

function renderCalendar() {
    releaseCalendar.innerHTML = '';
    // Filtra jogos que possuem data, independente da categoria
    const releases = games.filter(g => g.date).sort((a, b) => new Date(a.date) - new Date(b.date));

    const cards = releases.map(game => {
        const dateObj = new Date(game.date + 'T00:00:00');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');

        return `
            <div class="min-w-[160px] max-w-[160px] gx-card border border-gray-800 rounded-lg overflow-hidden glass cursor-pointer">
                <img src="${game.cover || 'https://via.placeholder.com/160x200?text=Cover'}" loading="lazy" class="w-full h-40 object-cover">
                <div class="p-3 text-center bg-black/40">
                    <p class="text-xs font-bold text-gray-400 truncate">${game.title}</p>
                    <p class="text-sm font-black mt-1 text-white">${day} | ${month}</p>
                </div>
            </div>
        `;
    });

    releaseCalendar.innerHTML = cards.join('');
}

// --- OPERAÇÕES CRUD ---
let editingId = null;
let deletingId = null;

gameForm.onsubmit = async (e) => {
    e.preventDefault();

    const gameData = {
        title: document.getElementById('gameTitle').value,
        category: document.getElementById('gameCategory').value,
        date: document.getElementById('gameDate').value,
        notes: document.getElementById('gameNotes').value,
        favorite: document.getElementById('gameFav').checked,
        completed: document.getElementById('gameCompleted').checked
    };

    if (editingId) {
        await fetch(`/api/games/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData)
        });
        editingId = null;
    } else {
        await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gameData)
        });
    }

    await loadGames();
    closeModal();
    gameForm.reset();
};

function editGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;

    editingId = id;
    document.getElementById('modalTitle').textContent = 'Editar Jogo';
    document.getElementById('gameTitle').value = game.title;
    document.getElementById('gameCategory').value = game.category;
    document.getElementById('gameDate').value = game.date || '';
    document.getElementById('gameNotes').value = game.notes || '';
    document.getElementById('gameFav').checked = game.favorite || false;
    document.getElementById('gameCompleted').checked = game.completed || false;

    openModal();
}

function confirmDelete(id) {
    deletingId = id;
    const game = games.find(g => g.id === id);
    document.getElementById('deleteGameName').textContent = `Tem certeza que deseja remover "${game.title}"?`;
    document.getElementById('deleteModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('closing');
        document.body.style.overflow = '';
        deletingId = null;
    }, 250);
}

document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (deletingId) {
        await fetch(`/api/games/${deletingId}`, { method: 'DELETE' });
        await loadGames();
        closeDeleteModal();
    }
};

async function toggleFavorite(id) {
    await fetch(`/api/games/${id}/favorite`, { method: 'PATCH' });
    await loadGames();
}

// --- CONQUISTAS ---
async function openAchievements(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const modal = document.getElementById('achievementsModal');
    const title = document.getElementById('achievementsTitle');
    const progress = document.getElementById('achievementsProgress');
    const list = document.getElementById('achievementsList');

    title.textContent = `Conquistas — ${game.title}`;
    progress.textContent = 'Carregando...';
    list.innerHTML = '';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`/api/games/${gameId}/achievements`);
        if (!res.ok) {
            progress.textContent = '';
            list.innerHTML = `<p class="text-gray-500 text-center py-6">Não foi possível carregar as conquistas deste jogo (ele pode não ter conquistas na Steam).</p>`;
            return;
        }

        const { achievements, unlocked, total, completed } = await res.json();
        progress.textContent = total > 0 ? `${unlocked} de ${total} desbloqueadas (${Math.round((unlocked / total) * 100)}%)` : 'Este jogo não possui conquistas.';

        // Backend auto-marca completado ao detectar 100% — reflete no estado local
        if (completed && !game.completed) {
            game.completed = true;
            renderGames(currentFilter, true);
            loadStats();
        }

        list.innerHTML = achievements.map(a => `
            <div class="flex items-center gap-3 p-2 rounded-lg ${a.achieved ? 'bg-purple-500/10' : 'bg-gray-800/40 opacity-60'}">
                <img src="${a.icon}" loading="lazy" class="w-10 h-10 rounded shrink-0">
                <div class="min-w-0">
                    <p class="text-sm font-semibold truncate">${a.name}</p>
                    <p class="text-xs text-gray-400 truncate">${a.description}</p>
                </div>
            </div>
        `).join('');
    } catch (err) {
        progress.textContent = '';
        list.innerHTML = `<p class="text-gray-500 text-center py-6">Erro ao buscar conquistas.</p>`;
    }
}

function closeAchievementsModal() {
    const modal = document.getElementById('achievementsModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- METADATA (GÊNERO, SINOPSE, SCREENSHOTS) ---
async function openMetadata(gameId) {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const modal = document.getElementById('metadataModal');
    const title = document.getElementById('metadataTitle');
    const body = document.getElementById('metadataBody');

    title.textContent = game.title;
    body.innerHTML = '<p class="text-gray-500">Carregando...</p>';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    try {
        const res = await fetch(`/api/games/${gameId}/metadata`);
        if (!res.ok) {
            body.innerHTML = `<p class="text-gray-500 text-center py-6">Não foi possível carregar detalhes deste jogo.</p>`;
            return;
        }

        const updated = await res.json();
        const idx = games.findIndex(g => g.id === gameId);
        if (idx !== -1) games[idx] = updated;

        const screenshotsHtml = (updated.screenshots || []).length > 0
            ? `<div class="flex gap-2 overflow-x-auto custom-scroll pb-2">${updated.screenshots.map(s => `<img src="${s}" class="h-32 rounded-lg object-cover shrink-0">`).join('')}</div>`
            : '';

        body.innerHTML = `
            ${updated.genre ? `<p class="text-sm"><span class="text-gray-500">Gênero:</span> ${updated.genre}</p>` : ''}
            ${updated.metacritic ? `<p class="text-sm"><span class="text-gray-500">Nota Metacritic:</span> ${updated.metacritic}</p>` : ''}
            ${updated.synopsis ? `<p class="text-sm text-gray-300 leading-relaxed">${updated.synopsis}</p>` : ''}
            ${screenshotsHtml}
            ${!updated.genre && !updated.synopsis && screenshotsHtml === '' ? '<p class="text-gray-500 text-center py-6">Nenhuma informação adicional encontrada para este jogo.</p>' : ''}
        `;
    } catch (err) {
        body.innerHTML = `<p class="text-gray-500 text-center py-6">Erro ao buscar detalhes.</p>`;
    }
}

function closeMetadataModal() {
    const modal = document.getElementById('metadataModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// --- NOTÍCIAS ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text ?? '';
    return div.innerHTML;
}

let newsItems = [];

async function loadNews() {
    const feed = document.getElementById('newsFeed');
    try {
        const res = await fetch('/api/news');
        if (!res.ok) { feed.innerHTML = ''; return; }
        const { news } = await res.json();
        newsItems = news;

        if (news.length === 0) {
            feed.innerHTML = '<p class="text-gray-500 text-sm">Nenhuma notícia recente dos seus jogos (marque jogos como "Jogando", "Backlog", favoritos ou com prioridade 📰 para ver notícias deles).</p>';
            return;
        }

        feed.innerHTML = news.map((n, i) => {
            const date = new Date(n.date * 1000).toLocaleDateString('pt-BR');
            return `
                <button type="button" onclick="openNewsModal(${i})" class="min-w-[280px] max-w-[280px] text-left gx-card border border-gray-800 rounded-lg overflow-hidden glass cursor-pointer">
                    <img src="${escapeHtml(n.cover || 'https://via.placeholder.com/280x112?text=Sem+Capa')}" loading="lazy" class="w-full h-28 object-cover">
                    <div class="p-3">
                        <p class="text-xs text-red-400 font-bold truncate">${escapeHtml(n.gameTitle)}</p>
                        <p class="text-sm font-semibold line-clamp-2 mt-1">${escapeHtml(n.title)}</p>
                        <p class="text-xs text-gray-400 line-clamp-2 mt-1">${escapeHtml(n.contents)}</p>
                        <p class="text-xs text-gray-500 mt-2">${date}${n.feedlabel ? ` · ${escapeHtml(n.feedlabel)}` : ''}</p>
                    </div>
                </button>`;
        }).join('');
    } catch (err) {
        feed.innerHTML = '';
    }
}

function openNewsModal(index) {
    const n = newsItems[index];
    if (!n) return;

    document.getElementById('newsModalTitle').textContent = n.title;
    document.getElementById('newsModalMeta').textContent =
        `${n.gameTitle} · ${new Date(n.date * 1000).toLocaleDateString('pt-BR')}${n.feedlabel ? ` · ${n.feedlabel}` : ''}`;
    const body = document.getElementById('newsModalBody');
    if (n.contentsHtml && n.contentsHtml.trim()) {
        body.innerHTML = n.contentsHtml;
    } else {
        body.textContent = n.contents || 'Sem conteúdo disponível.';
    }

    const link = document.getElementById('newsModalLink');
    if (n.url) {
        link.href = n.url;
        link.classList.remove('hidden');
    } else {
        link.classList.add('hidden');
    }

    document.getElementById('newsModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeNewsModal() {
    document.getElementById('newsModal').classList.add('hidden');
    document.body.style.overflow = '';
}

async function toggleNewsPriority(id) {
    await fetch(`/api/games/${id}/news-priority`, { method: 'PATCH' });
    await loadGames();
    loadNews();
}

// --- INTERFACE E NAVEGAÇÃO ---

function filterGames(category) {
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('text-red-500', 'font-bold'));
    event.target.classList.add('text-red-500', 'font-bold');
    renderGames(category);
}

function openModal() {
    document.getElementById('gameModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('gameModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('closing');
        document.body.style.overflow = '';
        editingId = null;
        document.getElementById('modalTitle').textContent = 'Cadastrar Novo Jogo';
        gameForm.reset();
    }, 250);
}

// --- AUTENTICAÇÃO STEAM ---
async function loadSteamUser() {
    const loginScreen = document.getElementById('loginScreen');
    const appShell = document.getElementById('appShell');
    const steamAuthArea = document.getElementById('steamAuthArea');

    try {
        const res = await fetch('/api/user');
        const { user } = await res.json();

        if (user) {
            loginScreen.classList.add('hidden');
            appShell.classList.remove('hidden');
            steamAuthArea.innerHTML = `
                <div class="flex items-center gap-2">
                    <img src="${user.photos?.[2]?.value || user.photos?.[0]?.value || ''}" class="w-8 h-8 rounded-full border border-gray-700">
                    <span class="text-sm font-semibold">${user.displayName}</span>
                    <button onclick="logoutSteam()" class="text-xs text-gray-400 hover:text-red-400 transition">Sair</button>
                </div>
            `;
            await loadGames();
            loadNews();
            importSteamLibrary();
        } else {
            appShell.classList.add('hidden');
            loginScreen.classList.remove('hidden');
        }
    } catch (err) {
        // Backend indisponível (ex: abrindo o HTML direto sem o servidor rodando)
        loginScreen.querySelector('p').textContent = 'Não foi possível conectar ao servidor. Rode o app via "docker compose up" ou "npm start".';
    }
}

async function logoutSteam() {
    await fetch('/api/logout', { method: 'POST' });
    loadSteamUser();
}

// --- BIBLIOTECA STEAM ---
function showLibraryWarning(message) {
    const warning = document.getElementById('libraryWarning');
    if (!message) {
        warning.classList.add('hidden');
        warning.textContent = '';
        return;
    }
    warning.textContent = message;
    warning.classList.remove('hidden');
}

async function importSteamLibrary() {
    try {
        const res = await fetch('/api/library');
        if (!res.ok) {
            showLibraryWarning('Não foi possível buscar sua biblioteca da Steam agora. Tente recarregar a página em instantes.');
            return;
        }
        const { games: steamGames } = await res.json();

        if (steamGames.length === 0) {
            showLibraryWarning('Nenhum jogo encontrado na sua conta Steam. Se você tem jogos na biblioteca, verifique se seu perfil Steam está público (Perfil > Editar Perfil > Privacidade > "Detalhes do jogo").');
        } else {
            showLibraryWarning(null);
        }

        await loadGames();
    } catch (err) {
        // Perfil privado ou API da Steam indisponível: mantém os jogos já salvos no servidor
    }
}

// --- INICIALIZAÇÃO ---
loadSteamUser();
