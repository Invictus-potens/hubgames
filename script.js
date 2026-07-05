// ============================
// Hub Game
// ============================

// --- ESTADO (CORE) ---
let games = JSON.parse(localStorage.getItem('myGamesVault')) || [];

const gameForm = document.getElementById('gameForm');
const gamesGrid = document.getElementById('gamesGrid');
const releaseCalendar = document.getElementById('releaseCalendar');

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function renderGames(filter = 'all') {
    gamesGrid.innerHTML = '';

    const filtered = games.filter(g => {
        if (filter === 'all') return g.category !== 'release';
        if (filter === 'fav') return g.favorite;
        return g.category === filter;
    });

    if (filtered.length === 0) {
        gamesGrid.innerHTML = `<p class="col-span-full text-gray-500 text-center py-10">Nenhum jogo encontrado nesta categoria.</p>`;
    }

    filtered.forEach(game => {
        const categoryLabels = { playing: 'Jogando', played: 'Já Joguei', old: 'Antigo', new: 'Novo', release: 'Calendário' };
        const playtimeBadge = game.playtimeForever != null
            ? `<p class="text-xs text-gray-500 mb-2">${(game.playtimeForever / 60).toFixed(1)}h jogadas${game.playtime2Weeks ? ` · ${(game.playtime2Weeks / 60).toFixed(1)}h nas últimas 2 semanas` : ''}</p>`
            : '';
        const card = `
            <div class="glass p-4 rounded-xl group relative gx-card border border-gray-800 cursor-default">
                <img src="${game.cover || 'https://via.placeholder.com/300x400?text=Sem+Capa'}" class="w-full h-48 object-cover rounded-lg mb-4 shadow-lg">
                ${game.favorite ? '<span class="absolute top-6 right-6 text-yellow-400 text-xl drop-shadow-lg">★</span>' : ''}
                <h4 class="font-bold text-lg mb-1 truncate">${game.title}</h4>
                <p class="text-xs text-gray-500 mb-3 uppercase tracking-widest">${categoryLabels[game.category] || game.category}</p>
                ${playtimeBadge}
                <p class="text-sm text-gray-400 line-clamp-2 italic">"${game.notes || 'Sem notas...'}"</p>
                <div class="mt-4 flex justify-end gap-2">
                    <button onclick="editGame(${game.id})" class="btn-icon bg-blue-500/10 hover:bg-blue-500/25" title="Editar">
                        <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                    <button onclick="toggleFavorite(${game.id})" class="btn-icon ${game.favorite ? 'bg-yellow-500/20 hover:bg-yellow-500/30' : 'bg-gray-500/10 hover:bg-yellow-500/15'}" title="Favoritar">
                        <svg class="w-4 h-4 ${game.favorite ? 'text-yellow-400' : 'text-gray-500'}" fill="${game.favorite ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                    </button>
                    <button onclick="confirmDelete(${game.id})" class="btn-icon bg-red-500/10 hover:bg-red-500/25" title="Remover">
                        <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;
        gamesGrid.innerHTML += card;
    });
}

function renderCalendar() {
    releaseCalendar.innerHTML = '';
    // Filtra jogos que possuem data, independente da categoria
    const releases = games.filter(g => g.date).sort((a, b) => new Date(a.date) - new Date(b.date));

    releases.forEach(game => {
        const dateObj = new Date(game.date + 'T00:00:00');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = dateObj.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');

        const card = `
            <div class="min-w-[160px] max-w-[160px] gx-card border border-gray-800 rounded-lg overflow-hidden glass cursor-pointer">
                <img src="${game.cover || 'https://via.placeholder.com/160x200?text=Cover'}" class="w-full h-40 object-cover">
                <div class="p-3 text-center bg-black/40">
                    <p class="text-xs font-bold text-gray-400 truncate">${game.title}</p>
                    <p class="text-sm font-black mt-1 text-white">${day} | ${month}</p>
                </div>
            </div>
        `;
        releaseCalendar.innerHTML += card;
    });
}

// --- OPERAÇÕES CRUD ---
let editingId = null;
let deletingId = null;

gameForm.onsubmit = (e) => {
    e.preventDefault();

    const gameData = {
        title: document.getElementById('gameTitle').value,
        category: document.getElementById('gameCategory').value,
        date: document.getElementById('gameDate').value,
        cover: '',
        notes: document.getElementById('gameNotes').value,
        favorite: document.getElementById('gameFav').checked
    };

    if (editingId) {
        // Editando jogo existente
        const idx = games.findIndex(g => g.id === editingId);
        if (idx !== -1) {
            games[idx] = { ...games[idx], ...gameData };
        }
        editingId = null;
    } else {
        // Criando novo jogo
        gameData.id = Date.now();
        games.push(gameData);
    }

    saveData();
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

document.getElementById('confirmDeleteBtn').onclick = () => {
    if (deletingId) {
        games = games.filter(g => g.id !== deletingId);
        saveData();
        closeDeleteModal();
    }
};

function toggleFavorite(id) {
    const idx = games.findIndex(g => g.id === id);
    games[idx].favorite = !games[idx].favorite;
    saveData();
}

function saveData() {
    localStorage.setItem('myGamesVault', JSON.stringify(games));
    renderGames();
    renderCalendar();
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
            return;
        }

        showLibraryWarning(null);

        steamGames.forEach(sg => {
            const id = `steam-${sg.appid}`;
            const existing = games.find(g => g.id === id);

            if (existing) {
                existing.playtimeForever = sg.playtime_forever;
                existing.playtime2Weeks = sg.playtime_2weeks;
            } else {
                games.push({
                    id,
                    title: sg.name,
                    category: sg.playtime_2weeks > 0 ? 'playing' : 'played',
                    date: '',
                    cover: `https://cdn.cloudflare.steamstatic.com/steam/apps/${sg.appid}/header.jpg`,
                    notes: '',
                    favorite: false,
                    appid: sg.appid,
                    playtimeForever: sg.playtime_forever,
                    playtime2Weeks: sg.playtime_2weeks
                });
            }
        });

        saveData();
    } catch (err) {
        // Perfil privado ou API da Steam indisponível: mantém os jogos já salvos localmente
    }
}

// --- INICIALIZAÇÃO ---
renderGames();
renderCalendar();
loadSteamUser();
