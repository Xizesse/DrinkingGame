const socket = io();

// ── UI Elements ───────────────────────────────────────────────────────────────
const screenHome  = document.getElementById('home-screen');
const screenLobby = document.getElementById('lobby-screen');
const screenGame  = document.getElementById('game-screen');

const inputName   = document.getElementById('player-name');
const inputRoom   = document.getElementById('room-code-input');
const btnCreate   = document.getElementById('btn-create');
const btnJoin     = document.getElementById('btn-join');
const errorMsg    = document.getElementById('error-message');

const lobbyCode   = document.getElementById('lobby-code');
const playersList = document.getElementById('players-list');
const playerCount = document.getElementById('player-count');
const btnStart    = document.getElementById('btn-start');
const waitingMsg  = document.getElementById('waiting-msg');

const cardTypeLabel   = document.getElementById('card-type-label');
const cardText        = document.getElementById('card-text');
const cardAction      = document.getElementById('card-action');
const btnNextCard     = document.getElementById('btn-next-card');
const dareActions     = document.getElementById('dare-actions');
const waitingHostText = document.getElementById('waiting-host-text');
const mySpellBar      = document.getElementById('my-spell-bar');

const currentIconDisplay = document.getElementById('lobby-icon-display');
const colorSwatches      = document.getElementById('color-swatches');

// ── State ─────────────────────────────────────────────────────────────────────
let currentName      = '';
let currentRoomCode  = '';
let globalPlayers    = [];
let globalCurrentCard = null;
let isLocalHost      = false;
let mySpells         = [];
let selectedSpellIndex = -1;

let myMinigameData  = null;
let minigameState   = {};
let myWordRevealed  = false;
let myBetPlaced     = false;

// Persistent token for reconnection
let myToken = localStorage.getItem('chalkDrinkingGameToken');
if (!myToken) {
  myToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('chalkDrinkingGameToken', myToken);
}

// ── Colors & Icons ────────────────────────────────────────────────────────────
const chalkColors = [
  '#e6194b','#3cb44b','#ffe119','#4363d8','#f58231',
  '#911eb4','#42d4f4','#f032e6','#bfef45','#9a6324',
  '#469990','#ffffff'
];
let myColor = chalkColors[Math.floor(Math.random() * chalkColors.length)];

const iconList = ['🍺','🍷','🥃','🍸','🍹','🧉','🍶','🍾','🧊','🍻','🥂','🫧'];
let currentIconIndex = Math.floor(Math.random() * iconList.length);
let currentIcon = iconList[currentIconIndex];

// ── Shot glass SVG (chalkboard style) ────────────────────────────────────────
function shotGlassSVG(size = 22, color = '#e9e9e9') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3 L18 3 L15.5 19 L8.5 19 Z"/>
    <line x1="7" y1="21" x2="17" y2="21"/>
    <line x1="12" y1="19" x2="12" y2="21"/>
    <line x1="7.5" y1="10" x2="16.5" y2="10" stroke-dasharray="2 1" stroke-opacity="0.6"/>
  </svg>`;
}

function shotGlassesHTML(n, size = 22) {
  return Array.from({ length: Math.min(n, 5) })
    .map(() => shotGlassSVG(size))
    .join('');
}

// ── Player icon rendering ─────────────────────────────────────────────────────
window.renderIcon = function (emoji, color, sizeClass = '') {
  let cleanEmoji = (emoji && emoji.includes('<img')) ? '🍺' : emoji;
  return `<div class="p-icon-circle ${sizeClass}" style="background-color:${color || '#ffffff'}">${cleanEmoji || '🍺'}</div>`;
};

currentIconDisplay.innerHTML = window.renderIcon(currentIcon, myColor, 'lg');

// ── Reconnect on boot ─────────────────────────────────────────────────────────
showScreen(screenHome);
socket.emit('reconnectAttempt', { token: myToken });

socket.on('reconnected', ({ room, player }) => {
  currentRoomCode = room.id;
  currentName     = player.name;
  isLocalHost     = player.isHost;
  mySpells        = [];
  updatePlayersList(room.players);

  if (room.status === 'playing') {
    showScreen(screenGame);
    renderTopBarPlayers(room.players);
    renderMySpellBar();
  } else {
    enterLobby(room);
  }
});

socket.on('reconnectFailed', () => { /* stay on home */ });

// ── Icon carousel ─────────────────────────────────────────────────────────────
document.getElementById('btn-icon-prev-lobby').addEventListener('click', () => {
  currentIconIndex = (currentIconIndex - 1 + iconList.length) % iconList.length;
  currentIcon = iconList[currentIconIndex];
  if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(currentIcon, myColor, 'lg');
  syncCustomization();
});

document.getElementById('btn-icon-next-lobby').addEventListener('click', () => {
  currentIconIndex = (currentIconIndex + 1) % iconList.length;
  currentIcon = iconList[currentIconIndex];
  if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(currentIcon, myColor, 'lg');
  syncCustomization();
});

function syncCustomization() {
  if (currentRoomCode) {
    socket.emit('updatePlayerCustomization', { code: currentRoomCode, icon: currentIcon, color: myColor });
  }
}

// ── Color selector ────────────────────────────────────────────────────────────
function renderColorSelector() {
  if (!colorSwatches) return;
  colorSwatches.innerHTML = '';
  const takenColors = (globalPlayers || [])
    .filter(p => p.id !== socket.id)
    .map(p => p.color);

  chalkColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    const isTaken = takenColors.includes(color);
    if (color === myColor) swatch.classList.add('selected');
    if (isTaken) swatch.classList.add('taken');
    swatch.style.backgroundColor = color;
    if (!isTaken) {
      swatch.onclick = () => {
        myColor = color;
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(currentIcon, myColor, 'lg');
        syncCustomization();
      };
    }
    colorSwatches.appendChild(swatch);
  });
}

// ── Lobby buttons ─────────────────────────────────────────────────────────────
btnCreate.addEventListener('click', () => {
  const name = inputName.value.trim();
  if (!name) { showError('Mete o teu nome seu bêbado!'); return; }
  currentName = name;
  socket.emit('createRoom', { playerName: name, icon: currentIcon, color: myColor, token: myToken });
});

btnJoin.addEventListener('click', () => {
  const name = inputName.value.trim();
  const code = inputRoom.value.trim().toUpperCase();
  if (!name || code.length !== 4) { showError('Nome e/ou código da sala errados seu bêbado!'); return; }
  currentName = name;
  socket.emit('joinRoom', { code, playerName: name, icon: currentIcon, color: myColor, token: myToken });
});

btnStart.addEventListener('click', () => {
  socket.emit('startGame', { code: currentRoomCode });
});

btnNextCard.addEventListener('click', () => {
  socket.emit('nextCard', { code: currentRoomCode });
});

// ── Room events ───────────────────────────────────────────────────────────────
socket.on('roomCreated', room => enterLobby(room));
socket.on('roomJoined',  room => enterLobby(room));
socket.on('playerJoined', players => updatePlayersList(players));
socket.on('playerLeft',   players => updatePlayersList(players));
socket.on('error', err => showError(err.message));

socket.on('gameStarted', () => {
  showScreen(screenGame);
  renderTopBarPlayers(globalPlayers);
  renderMySpellBar();
});

// ── Card rendering ────────────────────────────────────────────────────────────
const cardTypeMap = {
  'Drink Card':      { label: 'CARTA DE BEBIDA', color: '#74b9ff' },
  'Voting Card':     { label: 'VOTAÇÃO',          color: '#a8df65' },
  'Event Card':      { label: 'EVENTO',           color: '#ff6b6b' },
  'Dare Card':       { label: 'DESAFIO',          color: '#a29bfe' },
  'Mini Game Card':  { label: 'MINIJOGO',         color: '#ffe119' },
};

const cardRenderers = {
  'Drink Card':     renderDrinkCard,
  'Voting Card':    renderVotingCard,
  'Event Card':     renderEventCard,
  'Dare Card':      renderDareCard,
  'Mini Game Card': renderMiniGameCard,
};

socket.on('newCard', card => {
  globalCurrentCard = card;
  myMinigameData  = null;
  minigameState   = {};
  myWordRevealed  = false;
  myBetPlaced     = false;
  dareActions.style.display     = 'none';
  waitingHostText.style.display = 'none';

  const typeInfo = cardTypeMap[card.type] || { label: card.type.toUpperCase(), color: '#e9e9e9' };
  cardTypeLabel.textContent = typeInfo.label;
  cardTypeLabel.style.color = typeInfo.color;
  cardText.innerHTML = card.text;
  cardAction.innerHTML = '';

  const renderer = cardRenderers[card.type];
  if (renderer) renderer(card);
});

function renderDrinkCard(card) {
  cardAction.innerHTML = `
    <div class="shot-glasses" style="margin-top:auto;border-top:2px dashed var(--chalk-white);padding-top:12px;">
      ${shotGlassesHTML(card.drinks)}
      <strong style="margin-left:6px;font-size:1.2rem">(${card.drinks})</strong>
    </div>`;
}

function renderVotingCard(card) {
  let html = `<div class="timer" id="timer-display">${card.time}</div>`;
  html += `<div class="voting-list">`;
  globalPlayers.forEach(p => {
    const iconHtml = window.renderIcon(p.icon, p.color, 'sm');
    const isMe = p.id === socket.id
      ? '<span style="margin-left:auto;font-size:11px;color:var(--chalk-dim)">(você)</span>'
      : '';
    html += `<button class="btn-vote" data-id="${p.id}" onclick="voteFor('${p.id}')">
      ${iconHtml}
      <span style="color:${p.color};font-weight:600">${p.name}</span>
      ${isMe}
    </button>`;
  });
  html += `</div>`;
  cardAction.innerHTML = html;
}

function renderEventCard(card) {
  playBang();
  const cardEl = document.getElementById('current-card');
  cardEl.classList.add('event-card-active');
  setTimeout(() => cardEl.classList.remove('event-card-active'), 2000);

  let html = `<div class="subtext">${card.subtext} ${shotGlassSVG(14, '#a0a0a0')}</div>`;
  html += `<div class="timer" id="timer-display">${card.time}</div>`;

  if (card.interactive === 'color_buttons' || card.interactive === 'color_buttons_stroop') {
    html += renderColorButtonGrid(card);
  } else if (card.interactive) {
    html += `<button class="btn-big-red" id="btn-event-press" onclick="pressEvent()">PRESS HERE</button>`;
  }
  cardAction.innerHTML = html;
}

function renderColorButtonGrid(card) {
  let html = `<div class="color-btn-grid">`;
  card.colorButtons.forEach(btn => {
    const label = btn.word
      ? `<span style="color:${btn.wordColor};font-size:clamp(13px,3.5vw,17px);font-weight:900;letter-spacing:1px">${btn.word}</span>`
      : '';
    html += `<button class="btn-color-pick" style="background:${btn.hex}" id="cbtn-${btn.key}" onclick="pressColorButton('${btn.key}')">${label}</button>`;
  });
  html += `</div>`;
  return html;
}

function renderDareCard(card) {
  cardAction.innerHTML = `
    <div style="flex:1"></div>
    <div class="shot-glasses" style="margin-bottom:6px">
      ${shotGlassesHTML(card.drinks, 26)}
    </div>`;
  if (isLocalHost) {
    dareActions.style.display = 'flex';
  } else {
    waitingHostText.style.display = 'block';
  }
}

function renderMiniGameCard(card) {
  let html = `<div class="timer" id="timer-display">${card.time}</div>`;
  if (card.minigameType === 'impostor') {
    html += `
      <div id="mg-word-box" class="mg-word-box">
        <div class="subtext">A aguardar a tua palavra...</div>
      </div>`;
  } else if (card.minigameType === 'betting') {
    html += `<div id="mg-betting" class="mg-betting"><div class="subtext">A preparar o desafio...</div></div>
             <div id="mg-bets" class="mg-bets"></div>`;
  }
  cardAction.innerHTML = html;
}

function updateImpostorWordBox() {
  const box = document.getElementById('mg-word-box');
  if (!box || !myMinigameData) return;
  const word = myMinigameData.word;
  const flippedClass = myWordRevealed ? 'flipped' : '';
  const btnText = myWordRevealed ? 'HIDE CARD' : 'SHOW CARD';

  box.innerHTML = `
    <div class="mg-explanation">Descobre quem é o Impostor e não sejas apanhado!</div>
    <div class="mg-flip-card ${flippedClass}">
      <div class="mg-flip-card-inner" onclick="toggleImpostorReveal()">
        <div class="mg-flip-card-front">?</div>
        <div class="mg-flip-card-back">${word}</div>
      </div>
    </div>
    <button class="mg-reveal-btn" onclick="toggleImpostorReveal()">${btnText}</button>
  `;
}

window.toggleImpostorReveal = function () {
  if (!myMinigameData) return;
  myWordRevealed = !myWordRevealed;
  updateImpostorWordBox();
};

function updateBettingUI() {
  const bettingEl = document.getElementById('mg-betting');
  const betsEl    = document.getElementById('mg-bets');

  if (bettingEl && minigameState.player1 && minigameState.player2) {
    const { player1, player2, challenge, maxBet = 5 } = minigameState;
    const isCompetitor = socket.id === player1.id || socket.id === player2.id;

    let html = `
      <div class="mg-competitors">
        <div class="mg-competitor">
          ${window.renderIcon(player1.icon, player1.color)}
          <span style="color:${player1.color}">${player1.name}</span>
        </div>
        <span class="mg-vs">⚔️</span>
        <div class="mg-competitor">
          ${window.renderIcon(player2.icon, player2.color)}
          <span style="color:${player2.color}">${player2.name}</span>
        </div>
      </div>
      <div class="subtext">${challenge}</div>`;

    if (isCompetitor) {
      html += `<div class="subtext" style="margin-top:6px">Estás no desafio! Boa sorte! 💪</div>`;
      if (isLocalHost) {
        html += `<div class="mg-declare-row">
          <button class="btn-chalk mg-winner-btn" onclick="declareWinner('${player1.id}')">🏆 ${player1.name}</button>
          <button class="btn-chalk mg-winner-btn" onclick="declareWinner('${player2.id}')">🏆 ${player2.name}</button>
        </div>`;
      }
    } else if (!myBetPlaced) {
      html += `
        <div class="mg-bet-form">
          <div class="subtext">Quanto apostas? (máx ${maxBet})</div>
          <input type="number" id="bet-amount" min="1" max="${maxBet}" value="1" class="mg-bet-input">
          <div class="mg-bet-row">
            <button class="btn-chalk mg-bet-btn" onclick="placeBet('${player1.id}')">Aposto em ${player1.name}</button>
            <button class="btn-chalk mg-bet-btn" onclick="placeBet('${player2.id}')">Aposto em ${player2.name}</button>
          </div>
        </div>`;
    } else {
      html += `<div class="subtext" style="margin-top:6px">Aposta feita! A aguardar... ⏳</div>`;
    }

    bettingEl.innerHTML = html;
  }

  if (betsEl && minigameState.bets) {
    const entries = Object.entries(minigameState.bets);
    if (entries.length === 0) { betsEl.innerHTML = ''; return; }
    let html = '<div class="mg-bets-list">';
    entries.forEach(([playerId, bet]) => {
      const p = globalPlayers.find(x => x.id === playerId);
      const voted = globalPlayers.find(x => x.id === bet.votedFor);
      if (!p) return;
      html += `<div class="mg-bet-entry">
        ${window.renderIcon(p.icon, p.color, 'sm')}
        <span style="color:${p.color}">${p.name}</span>
        <span class="mg-bet-label">apostou ${bet.amount} em ${voted ? voted.name : '?'}</span>
      </div>`;
    });
    html += '</div>';
    betsEl.innerHTML = html;
  }
}

window.placeBet = function (votedFor) {
  if (myBetPlaced) return;
  const amount = parseInt(document.getElementById('bet-amount').value) || 1;
  myBetPlaced = true;
  socket.emit('minigameAction', { code: currentRoomCode, payload: { action: 'place_bet', amount, votedFor } });
  updateBettingUI();
};

window.declareWinner = function (winnerId) {
  socket.emit('minigameAction', { code: currentRoomCode, payload: { action: 'declare_winner', votedFor: winnerId } });
};

socket.on('minigamePlayerData', data => {
  myMinigameData = data;
  if (globalCurrentCard && globalCurrentCard.minigameType === 'impostor') {
    updateImpostorWordBox();
  }
});

socket.on('minigameStateUpdate', state => {
  minigameState = { ...minigameState, ...state };
  if (!globalCurrentCard) return;
  if (globalCurrentCard.minigameType === 'betting')  updateBettingUI();
});

// ── Timer ─────────────────────────────────────────────────────────────────────
socket.on('timerUpdate', t => {
  const td = document.getElementById('timer-display');
  if (td) td.textContent = t;
});

// ── Results ───────────────────────────────────────────────────────────────────
socket.on('cardResults', data => {
  dareActions.style.display     = 'none';
  waitingHostText.style.display = 'none';

  let consequence = data.consequence || '';
  if (consequence.includes('{drinks}') && globalCurrentCard?.drinks) {
    consequence = consequence.replace('{drinks}', `<strong>${globalCurrentCard.drinks}</strong>`);
  }

  const statsHtml = (data.stats || []).map(s => {
    const voterIcons = s.voters.map(v =>
      `<div style="transform:scale(1.1);margin:0 2px">${window.renderIcon(v.icon, v.color, 'sm')}</div>`
    ).join('');
    const name = s.player.name.length > 8 ? s.player.name.substring(0, 6) + '..' : s.player.name;
    return `<div>
      ${window.renderIcon(s.player.icon, s.player.color, 'sm')}
      <span style="font-size:1.4rem;color:${s.player.color || '#fff'}">${name}</span>
      ${voterIcons ? `<div style="display:flex;margin-left:auto">${voterIcons}</div>` : ''}
    </div>`;
  }).join('');

  cardAction.innerHTML = `
    <div class="card-consequence">${consequence} !!</div>
    <div class="stats-list">${statsHtml}</div>`;
});

// ── Voting ────────────────────────────────────────────────────────────────────
window.voteFor = function (id) {
  socket.emit('votePlayer', { code: currentRoomCode, targetId: id });
  document.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('selected-vote'));
  const clicked = Array.from(document.querySelectorAll('.btn-vote')).find(b => b.dataset.id === id);
  if (clicked) clicked.classList.add('selected-vote');
};

// ── Dare ──────────────────────────────────────────────────────────────────────
window.dareResult = function (result) {
  socket.emit('dareResult', { code: currentRoomCode, result });
};

// ── Event card actions (both route through the unified cardAction event) ──────
window.pressEvent = function () {
  if (navigator.vibrate) navigator.vibrate([500]);
  socket.emit('cardAction', { code: currentRoomCode, payload: {} });
  const btn = document.getElementById('btn-event-press');
  if (btn) { btn.disabled = true; btn.innerHTML = 'PRESSED!'; btn.classList.add('pressed'); }
};

window.pressColorButton = function (colorKey) {
  if (navigator.vibrate) navigator.vibrate([200]);
  socket.emit('cardAction', { code: currentRoomCode, payload: { colorKey } });
  document.querySelectorAll('.btn-color-pick').forEach(btn => {
    btn.disabled = true;
    if (btn.id !== `cbtn-${colorKey}`) btn.classList.add('color-btn-dim');
  });
  const selected = document.getElementById(`cbtn-${colorKey}`);
  if (selected) selected.classList.add('color-btn-selected');
};

// ── Wheel ─────────────────────────────────────────────────────────────────────
window.spinWheel = function () {
  socket.emit('spinWheel', { code: currentRoomCode });
  const btn = document.getElementById('btn-spin');
  if (btn) btn.disabled = true;
};

socket.on('showWheel', ({ targetPlayer }) => {
  cardText.textContent = '';
  let html = `<div class="subtext">A Roda do Castigo para ${targetPlayer.name}!</div>`;
  html += `
    <div class="wheel-wrap">
      <div id="wheel-container" style="position:absolute;width:100%;height:100%;border-radius:50%;
        border:4px solid var(--chalk-white);
        background:linear-gradient(to bottom,var(--chalk-dim) 50%,var(--bg-color) 50%);
        transition:transform 3s cubic-bezier(0.25,1,0.5,1)">
        <div style="position:absolute;width:100%;height:50%;top:0;display:flex;justify-content:center;align-items:center;font-size:2rem;font-weight:bold;color:var(--bg-color)">SAFE</div>
        <div style="position:absolute;width:100%;height:50%;bottom:0;display:flex;justify-content:center;align-items:center;font-size:2rem;font-weight:bold;color:var(--chalk-white);transform:rotate(180deg)">DOUBLE</div>
      </div>
      <div style="position:absolute;top:-12px;left:50%;width:0;height:0;border-left:12px solid transparent;border-right:12px solid transparent;border-top:25px solid red;transform:translateX(-50%);z-index:10"></div>
    </div>`;
  if (socket.id === targetPlayer.id) {
    html += `<button class="btn-chalk" style="margin-top:20px;border-color:#ff6b6b;color:#ff6b6b" onclick="spinWheel()" id="btn-spin">GIRAR A RODA!</button>`;
  } else {
    html += `<div class="subtext" style="margin-top:20px">A aguardar que a roda gire...</div>`;
  }
  cardAction.innerHTML = html;
});

socket.on('wheelSpinning', ({ multiplier }) => {
  const wheel = document.getElementById('wheel-container');
  if (wheel) {
    let angle = 1800;
    if (multiplier !== 0) angle += 180;
    wheel.style.transform = `rotate(${angle}deg)`;
  }
});

// ── Spell bar (current player only) ──────────────────────────────────────────
function renderMySpellBar() {
  if (!mySpellBar) return;

  // Find my player data for color
  const me = globalPlayers.find(p => p.id === socket.id);
  const meColor = me ? me.color : '#ffffff';
  const meIcon  = me ? window.renderIcon(me.icon, me.color, 'sm') : '';

  let html = meIcon;
  html += `<div style="flex:1"></div><div style="display:flex;gap:10px">`;

  for (let i = 0; i < 3; i++) {
    const spell = mySpells[i];
    if (spell) {
      html += `<div class="spell-slot filled" onclick="openSpellModal(${i})" title="${spell.name}">${spell.icon}</div>`;
    } else {
      html += `<div class="spell-slot"></div>`;
    }
  }

  html += `</div>`;
  mySpellBar.innerHTML = html;
  mySpellBar.style.display = 'flex';
}

window.openSpellModal = function (index) {
  selectedSpellIndex = index;
  const spell = mySpells[index];
  if (!spell) return;
  document.getElementById('spell-modal-title').textContent = spell.name;
  document.getElementById('spell-modal-icon').innerHTML = spell.icon;
  document.getElementById('spell-modal-desc').textContent = spell.description;
  document.getElementById('spell-modal').style.display = 'flex';
};

window.closeSpellModal = function () {
  document.getElementById('spell-modal').style.display = 'none';
};

window.openSpellGrantedModal = function (spell) {
  document.getElementById('spell-granted-title').textContent = spell.name;
  document.getElementById('spell-granted-icon').innerHTML = spell.icon;
  document.getElementById('spell-granted-desc').textContent = spell.description;
  document.getElementById('spell-granted-modal').style.display = 'flex';
};

window.closeSpellGrantedModal = function () {
  document.getElementById('spell-granted-modal').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
  const btnUseSpell = document.getElementById('btn-use-spell');
  if (btnUseSpell) {
    btnUseSpell.addEventListener('click', () => {
      if (selectedSpellIndex >= 0 && mySpells[selectedSpellIndex]) {
        const spell = mySpells[selectedSpellIndex];
        socket.emit('useSpell', { code: currentRoomCode, spellId: spell.id });
        mySpells.splice(selectedSpellIndex, 1);
        renderMySpellBar();
        closeSpellModal();
      }
    });
  }
});

socket.on('spellGranted', spell => {
  mySpells.push(spell);
  renderMySpellBar();
  openSpellGrantedModal(spell);
});

socket.on('spellUsed', ({ message }) => {
  showToast(message, 5000);
});

// ── Player list & top bar ─────────────────────────────────────────────────────
function updatePlayersList(players) {
  globalPlayers = players;
  playersList.innerHTML = '';
  playerCount.textContent = players.length;
  renderTopBarPlayers(players);
  renderColorSelector();

  let isHost = false;

  players.forEach(p => {
    const li = document.createElement('li');

    const iconSpan = document.createElement('span');
    iconSpan.innerHTML = window.renderIcon(p.icon, p.color, 'sm');
    li.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name + (p.id === socket.id ? ' (You)' : '');
    nameSpan.style.color = p.color || '#ffffff';
    li.appendChild(nameSpan);

    if (p.isHost) {
      const badge = document.createElement('span');
      badge.className = 'host-badge';
      badge.textContent = 'HOST';
      li.appendChild(badge);
      if (p.id === socket.id) isHost = true;
    }

    playersList.appendChild(li);
  });

  isLocalHost = isHost;

  if (isHost) {
    btnStart.style.display = players.length >= 2 ? 'block' : 'none';
    btnNextCard.style.display = 'block';
    waitingMsg.style.display = players.length < 2 ? 'block' : 'none';
    if (players.length < 2) waitingMsg.textContent = 'Precisas de pelo menos 2 jogadores...';
  } else {
    btnStart.style.display    = 'none';
    btnNextCard.style.display = 'none';
    waitingMsg.style.display  = 'block';
    waitingMsg.textContent    = 'À espera do anfitrião...';
  }
}

function renderTopBarPlayers(players) {
  const bar = document.getElementById('top-players-bar');
  if (!bar) return;
  bar.innerHTML = players.map(p =>
    `<div class="top-icon-wrapper ${p.disconnected ? 'ghost-icon' : ''}" title="${p.name}">
       ${window.renderIcon(p.icon, p.color, 'sm')}
     </div>`
  ).join('');
}

socket.on('playerStatusUpdate', players => {
  globalPlayers = players;
  renderTopBarPlayers(players);
});

socket.on('hostDisconnected', () => {
  document.getElementById('host-disconnected-overlay').style.display = 'flex';
});

socket.on('hostReconnected', () => {
  document.getElementById('host-disconnected-overlay').style.display = 'none';
});

// ── Server config (test mode) ─────────────────────────────────────────────────
socket.on('serverConfig', config => {
  if (config.testMode && !currentRoomCode) {
    currentName = 'Tester_' + Math.floor(Math.random() * 1000);
    socket.emit('joinTestRoom', { playerName: currentName, icon: currentIcon, token: myToken });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  screen.classList.add('screen-active');
}

function enterLobby(room) {
  showScreen(screenLobby);
  currentRoomCode = room.id;
  lobbyCode.textContent = room.id;
  renderColorSelector();
  updatePlayersList(room.players);
}

function showError(msg) {
  errorMsg.textContent = msg;
  setTimeout(() => errorMsg.textContent = '', 3000);
}

function playBang() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.3);
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  const card = document.getElementById('current-card');
  if (card) {
    card.classList.add('shake-anim');
    setTimeout(() => card.classList.remove('shake-anim'), 500);
  }
}

window.showToast = function (msg, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerText = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};
