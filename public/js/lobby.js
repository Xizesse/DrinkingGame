import { socket, state, chalkColors, iconList } from './state.js';
import { showScreen } from './utils.js';

export function enterLobby(room) {
  const screenLobby = document.getElementById('lobby-screen');
  showScreen(screenLobby);
  state.currentRoomCode = room.id;
  document.getElementById('lobby-code').textContent = room.id;
  renderColorSelector();
  updatePlayersList(room.players);
}

export function updatePlayersList(players) {
  state.globalPlayers = players;
  const playersList = document.getElementById('players-list');
  const playerCount = document.getElementById('player-count');
  
  if(playersList) playersList.innerHTML = '';
  if(playerCount) playerCount.textContent = players.length;
  
  renderTopBarPlayers(players);
  
  const me = players.find(p => p.id === socket.id);
  if (me) {
    state.myColor = me.color;
    state.currentIcon = me.icon;
    const currentIconDisplay = document.getElementById('lobby-icon-display');
    if (currentIconDisplay) {
      currentIconDisplay.innerHTML = window.renderIcon(state.currentIcon, state.myColor, 'lg');
    }
  }

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

    if(playersList) playersList.appendChild(li);
  });

  state.isLocalHost = isHost;

  const btnStart = document.getElementById('btn-start');
  const btnNextCard = document.getElementById('btn-next-card');
  const waitingMsg = document.getElementById('waiting-msg');

  if (isHost) {
    if(btnStart) btnStart.style.display = players.length >= 2 ? 'block' : 'none';
    if(btnNextCard) btnNextCard.style.display = 'block';
    if(waitingMsg) {
      waitingMsg.style.display = players.length < 2 ? 'block' : 'none';
      if (players.length < 2) waitingMsg.textContent = 'Precisas de pelo menos 2 jogadores...';
    }
  } else {
    if(btnStart) btnStart.style.display = 'none';
    if(btnNextCard) btnNextCard.style.display = 'none';
    if(waitingMsg) {
      waitingMsg.style.display  = 'block';
      waitingMsg.textContent    = 'À espera do anfitrião...';
    }
  }
}

export function renderTopBarPlayers(players) {
  const bar = document.getElementById('top-players-bar');
  if (!bar) return;
  bar.innerHTML = players.map(p =>
    `<div class="top-icon-wrapper ${p.disconnected ? 'ghost-icon' : ''}" title="${p.name}">
       ${window.renderIcon(p.icon, p.color, 'sm')}
     </div>`
  ).join('');
}

export function syncCustomization() {
  if (state.currentRoomCode) {
    socket.emit('updatePlayerCustomization', { code: state.currentRoomCode, icon: state.currentIcon, color: state.myColor });
  }
}

export function renderColorSelector() {
  const colorSwatches = document.getElementById('color-swatches');
  const currentIconDisplay = document.getElementById('lobby-icon-display');
  if (!colorSwatches) return;
  
  colorSwatches.innerHTML = '';
  const takenColors = (state.globalPlayers || [])
    .filter(p => p.id !== socket.id)
    .map(p => p.color);

  chalkColors.forEach(color => {
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    const isTaken = takenColors.includes(color);
    if (color === state.myColor) swatch.classList.add('selected');
    if (isTaken) swatch.classList.add('taken');
    swatch.style.backgroundColor = color;
    
    if (!isTaken) {
      swatch.onclick = () => {
        state.myColor = color;
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(state.currentIcon, state.myColor, 'lg');
        syncCustomization();
      };
    }
    colorSwatches.appendChild(swatch);
  });
}
