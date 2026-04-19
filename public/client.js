const socket = io();

// UI Elements
const screenHome = document.getElementById('home-screen');
const screenLobby = document.getElementById('lobby-screen');

const inputName = document.getElementById('player-name');
const inputRoom = document.getElementById('room-code-input');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const errorMsg = document.getElementById('error-message');

const lobbyCode = document.getElementById('lobby-code');
const playersList = document.getElementById('players-list');
const playerCount = document.getElementById('player-count');
const btnStart = document.getElementById('btn-start');
const waitingMsg = document.getElementById('waiting-msg');

const screenGame = document.getElementById('game-screen');
const cardText = document.getElementById('card-text');
const cardAction = document.getElementById('card-action');
const btnNextCard = document.getElementById('btn-next-card');

const currentIconDisplay = document.getElementById('current-icon-display');

let currentName = '';
let currentRoomCode = '';
let globalPlayers = [];
let isLocalHost = false;

let mySpells = [];
let selectedSpellIndex = -1;

window.voteFor = function (id) {
    socket.emit('votePlayer', { code: currentRoomCode, targetId: id });
    const btns = document.querySelectorAll('.btn-vote');
    btns.forEach(b => b.classList.remove('selected-vote'));
    const clicked = Array.from(btns).find(b => b.dataset.id === id);
    if (clicked) clicked.classList.add('selected-vote');
};

const iconList = [
    '<img src="icons/icon1.png" class="p-icon">',
    '<img src="icons/icon2.png" class="p-icon">',
    '<img src="icons/icon3.png" class="p-icon">',
    '<img src="icons/icon4.png" class="p-icon">'
];
let currentIconIndex = Math.floor(Math.random() * iconList.length);
let currentIcon = iconList[currentIconIndex];
currentIconDisplay.innerHTML = currentIcon;

// --- Event Listeners ---

// Icon selection
document.getElementById('btn-icon-prev').addEventListener('click', () => {
    currentIconIndex = (currentIconIndex - 1 + iconList.length) % iconList.length;
    currentIcon = iconList[currentIconIndex];
    currentIconDisplay.innerHTML = currentIcon;
});

document.getElementById('btn-icon-next').addEventListener('click', () => {
    currentIconIndex = (currentIconIndex + 1) % iconList.length;
    currentIcon = iconList[currentIconIndex];
    currentIconDisplay.innerHTML = currentIcon;
});

btnCreate.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) {
        showError("Please enter your name!");
        return;
    }
    currentName = name;
    socket.emit('createRoom', { playerName: name, icon: currentIcon });
});

btnJoin.addEventListener('click', () => {
    const name = inputName.value.trim();
    const code = inputRoom.value.trim();

    if (!name) {
        showError("Please enter your name!");
        return;
    }
    if (!code) {
        showError("Please enter a room code!");
        return;
    }

    currentName = name;
    socket.emit('joinRoom', { code, playerName: name, icon: currentIcon });
});

btnStart.addEventListener('click', () => {
    socket.emit('startGame', { code: currentRoomCode });
});

btnNextCard.addEventListener('click', () => {
    socket.emit('nextCard', { code: currentRoomCode });
});

// --- Socket Events ---

socket.on('roomCreated', (room) => {
    enterLobby(room);
});

socket.on('roomJoined', (room) => {
    enterLobby(room);
});

socket.on('playerJoined', (players) => {
    updatePlayersList(players);
});

socket.on('playerLeft', (players) => {
    updatePlayersList(players);
});

socket.on('error', (err) => {
    showError(err.message);
});

socket.on('gameStarted', () => {
    screenLobby.classList.remove('screen-active');
    screenGame.classList.add('screen-active');
});

function playBang() {
    if (window.AudioContext || window.webkitAudioContext) {
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
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { }
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    document.getElementById('current-card').classList.add('shake-anim');
    setTimeout(() => document.getElementById('current-card').classList.remove('shake-anim'), 500);
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
}

window.renderSpells = function () {
    const bar = document.getElementById('spells-bar');
    if (!bar) return;
    bar.innerHTML = '';
    mySpells.forEach((spell, i) => {
        const btn = document.createElement('button');
        btn.className = 'spell-btn';
        btn.innerHTML = spell.icon;
        btn.onclick = () => window.openSpellModal(i);
        bar.appendChild(btn);
    });
}

window.openSpellModal = function (index) {
    selectedSpellIndex = index;
    const spell = mySpells[index];
    document.getElementById('spell-modal-title').textContent = spell.name;
    document.getElementById('spell-modal-icon').innerHTML = spell.icon;
    document.getElementById('spell-modal-desc').textContent = spell.description;
    document.getElementById('spell-modal').style.display = 'flex';
}

window.closeSpellModal = function () {
    document.getElementById('spell-modal').style.display = 'none';
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
}

window.renderSpells = function () {
    const bar = document.getElementById('spells-bar');
    if (!bar) return;
    bar.innerHTML = '';
    mySpells.forEach((spell, i) => {
        const btn = document.createElement('button');
        btn.className = 'spell-btn';
        btn.innerHTML = spell.icon;
        btn.onclick = () => window.openSpellModal(i);
        bar.appendChild(btn);
    });
}

window.openSpellModal = function (index) {
    selectedSpellIndex = index;
    const spell = mySpells[index];
    document.getElementById('spell-modal-title').textContent = spell.name;
    document.getElementById('spell-modal-icon').innerHTML = spell.icon;
    document.getElementById('spell-modal-desc').textContent = spell.description;
    document.getElementById('spell-modal').style.display = 'flex';
}

window.closeSpellModal = function () {
    document.getElementById('spell-modal').style.display = 'none';
}

window.pressEvent = function () {
    // vamos forçar a vibração logo no instante limite em que clicas no botão:
    if (navigator.vibrate) navigator.vibrate([500]);

    socket.emit('eventPress', { code: currentRoomCode });
    const btn = document.getElementById('btn-event-press');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "PRESSED!";
        btn.classList.add('pressed');
    }
};

window.dareResult = function (result) {
    socket.emit('dareResult', { code: currentRoomCode, result });
};

window.spinWheel = function () {
    socket.emit('spinWheel', { code: currentRoomCode });
    const btn = document.getElementById('btn-spin');
    if (btn) btn.disabled = true;
};

socket.on('showWheel', ({ targetPlayer }) => {
    cardText.textContent = "";
    let wheelHtml = `<div class="subtext">A Roda do Castigo para ${targetPlayer.name}!</div>`;
    wheelHtml += `
      <div style="position:relative; width: 220px; height: 220px; margin: 20px auto;">
          <div id="wheel-container" style="position:absolute; width: 100%; height: 100%; border-radius: 50%; border: 4px solid var(--chalk-white); background: linear-gradient(to bottom, var(--chalk-dim) 50%, var(--bg-color) 50%); transition: transform 3s cubic-bezier(0.25, 1, 0.5, 1);">
             <div style="position:absolute; width:100%; height:50%; top:0; display:flex; justify-content:center; align-items:center; font-size:2.3rem; font-weight:bold; color: var(--bg-color);">SAFE</div>
             <div style="position:absolute; width:100%; height:50%; bottom:0; display:flex; justify-content:center; align-items:center; font-size:2.3rem; font-weight:bold; color: var(--chalk-white); transform: rotate(180deg);">DOUBLE</div>
          </div>
          <div style="position:absolute; top: -12px; left:50%; width: 0; height: 0; border-left: 12px solid transparent; border-right: 12px solid transparent; border-top: 25px solid red; transform: translateX(-50%); z-index: 10;"></div>
      </div>
    `;
    if (socket.id === targetPlayer.id) {
        wheelHtml += `<button class="btn-chalk" style="margin-top: 20px; border-color: #ff6b6b; color:#ff6b6b" onclick="spinWheel()" id="btn-spin">GIRAR A RODA!</button>`;
    } else {
        wheelHtml += `<div class="subtext" style="margin-top:20px;">A aguardar que a roda gire...</div>`;
    }
    cardAction.innerHTML = wheelHtml;
});

socket.on('wheelSpinning', ({ multiplier }) => {
    const wheel = document.getElementById('wheel-container');
    if (wheel) {
        let angle = 1800; // 5 full baseline spins
        if (multiplier !== 0) angle += 180; // land on double drinks (bottom slice)
        wheel.style.transform = `rotate(${angle}deg)`;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const btnUseSpell = document.getElementById('btn-use-spell');
    if (btnUseSpell) {
        btnUseSpell.addEventListener('click', () => {
            if (selectedSpellIndex >= 0) {
                const spell = mySpells[selectedSpellIndex];
                socket.emit('useSpell', { code: currentRoomCode, spellId: spell.id });
                mySpells.splice(selectedSpellIndex, 1);
                window.renderSpells();
                window.closeSpellModal();
            }
        });
    }
});

socket.on('spellGranted', (spell) => {
    mySpells.push(spell);
    window.renderSpells();
    window.showToast(`✨ Ganhaste um Feitiço: ${spell.icon} ${spell.name}!`);
});

socket.on('spellUsed', ({ player, spell, message }) => {
    window.showToast(message, 5000);
});

socket.on('newCard', (card) => {
    cardText.textContent = card.text;

    if (card.type === "Drink Card") {
        cardAction.innerHTML = `Bebe 🍺 (${card.drinks})`;
    } else if (card.type === "Voting Card") {
        let votingHtml = `<div class="timer" id="timer-display">${card.time}</div>`;
        votingHtml += `<div class="voting-list">`;
        globalPlayers.forEach(p => {
            if (p.id !== socket.id) { // optional: don't vote for self
                votingHtml += `<button class="btn-vote" data-id="${p.id}" onclick="voteFor('${p.id}')">${p.icon} ${p.name}</button>`;
            } else {
                votingHtml += `<button class="btn-vote" data-id="${p.id}" onclick="voteFor('${p.id}')">${p.icon} ${p.name} (You)</button>`;
            }
        });
        votingHtml += `</div>`;
        cardAction.innerHTML = votingHtml;
    } else if (card.type === "Event Card") {
        playBang();
        document.getElementById('current-card').className = 'chalk-card event-card-active';
        setTimeout(() => document.getElementById('current-card').className = 'chalk-card', 2000);

        let eventHtml = `<div class="subtext">${card.subtext}</div>`;
        eventHtml += `<div class="timer" id="timer-display">${card.time}</div>`;
        if (card.interactive) {
            eventHtml += `<button class="btn-big-red" id="btn-event-press" onclick="pressEvent()">PRESS HERE</button>`;
        }
        cardAction.innerHTML = eventHtml;
    } else if (card.type === "Dare Card") {
        let dareHtml = '';
        if (isLocalHost) {
            dareHtml += `
            <div style="display:flex; justify-content: space-evenly; gap: 15px; margin-top:20px;">
                <button class="btn-chalk" style="border-color: #a8df65; color: #a8df65;" onclick="dareResult('did_it')">They did it!</button>
                <button class="btn-chalk" style="border-color: #ff6b6b; color: #ff6b6b;" onclick="dareResult('drank')">They drank</button>
            </div>
            `;
        } else {
            dareHtml += `<div class="subtext">A aguardar a decisão do host...</div>`;
        }
        cardAction.innerHTML = dareHtml;
    }
});

socket.on('timerUpdate', (t) => {
    const td = document.getElementById('timer-display');
    if (td) td.textContent = t;
});

socket.on('cardResults', (data) => {
    const statsHtml = data.stats.map(s => {
        const voterIcons = s.voters.map(v => v.icon).join(' ');
        return `<div>${s.player.icon} ${s.player.name}: ${s.count} votos ${voterIcons ? ' <span style="font-size:1rem">' + voterIcons + '</span>' : ''}</div>`;
    }).join("");

    cardAction.innerHTML = `
      <div class="card-consequence">${data.consequence} !!</div>
      <div class="stats-list">${statsHtml}</div>
    `;
});

// --- Helper Functions ---

function showError(msg) {
    errorMsg.textContent = msg;
    setTimeout(() => errorMsg.textContent = '', 3000);
}

function enterLobby(room) {
    // Hide home, show lobby
    screenHome.classList.remove('screen-active');
    screenLobby.classList.add('screen-active');

    currentRoomCode = room.id;
    lobbyCode.textContent = room.id;

    updatePlayersList(room.players);
}

function updatePlayersList(players) {
    globalPlayers = players;
    playersList.innerHTML = '';
    playerCount.textContent = players.length;

    let isHost = false;

    players.forEach(p => {
        const li = document.createElement('li');

        const iconSpan = document.createElement('span');
        iconSpan.className = 'player-icon';
        iconSpan.innerHTML = p.icon || '<img src="icons/icon1.png" class="p-icon">';
        li.appendChild(iconSpan);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.name;
        if (p.id === socket.id) nameSpan.textContent += " (You)";
        li.appendChild(nameSpan);

        if (p.isHost) {
            const hostBadge = document.createElement('span');
            hostBadge.className = 'host-badge';
            hostBadge.textContent = 'HOST';
            li.appendChild(hostBadge);

            // Check if this client is the host
            if (p.id === socket.id) isHost = true;
        }

        playersList.appendChild(li);
    });

    isLocalHost = isHost;

    if (isHost) {
        btnStart.style.display = players.length >= 2 ? 'block' : 'none';
        btnNextCard.style.display = 'block';

        if (players.length < 2) {
            waitingMsg.style.display = 'block';
            waitingMsg.textContent = 'Need at least 2 players to start...';
        } else {
            waitingMsg.style.display = 'none';
        }
    } else {
        btnStart.style.display = 'none';
        btnNextCard.style.display = 'none';
        waitingMsg.style.display = 'block';
        waitingMsg.textContent = 'Waiting for the host...';
    }
}
