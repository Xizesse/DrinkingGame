import { socket, state, iconList } from './state.js';
import { showScreen, showError } from './utils.js';
import { syncCustomization } from './lobby.js';
import { initSocketListeners } from './socket-listeners.js';
import { renderMySpellBar, closeSpellModal } from './spells.js';

// Init sockets
initSocketListeners();

document.addEventListener('DOMContentLoaded', () => {
  const screenHome = document.getElementById('home-screen');
  const inputName = document.getElementById('player-name');
  const inputRoom = document.getElementById('room-code-input');
  const btnCreate = document.getElementById('btn-create');
  const btnJoin = document.getElementById('btn-join');
  const btnStart = document.getElementById('btn-start');
  const btnNextCard = document.getElementById('btn-next-card');
  const currentIconDisplay = document.getElementById('lobby-icon-display');

  if (currentIconDisplay) {
    currentIconDisplay.innerHTML = window.renderIcon(state.currentIcon, state.myColor, 'lg');
  }

  showScreen(screenHome);
  socket.emit('reconnectAttempt', { token: state.myToken });

  // Icon Carousel
  document.getElementById('btn-icon-prev-lobby')?.addEventListener('click', () => {
    state.currentIconIndex = (state.currentIconIndex - 1 + iconList.length) % iconList.length;
    state.currentIcon = iconList[state.currentIconIndex];
    if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(state.currentIcon, state.myColor, 'lg');
    syncCustomization();
  });

  document.getElementById('btn-icon-next-lobby')?.addEventListener('click', () => {
    state.currentIconIndex = (state.currentIconIndex + 1) % iconList.length;
    state.currentIcon = iconList[state.currentIconIndex];
    if (currentIconDisplay) currentIconDisplay.innerHTML = window.renderIcon(state.currentIcon, state.myColor, 'lg');
    syncCustomization();
  });

  // Buttons
  btnCreate?.addEventListener('click', () => {
    const name = inputName.value.trim();
    if (!name) { showError('Mete o teu nome seu bêbado!'); return; }
    state.currentName = name;
    socket.emit('createRoom', { playerName: name, icon: state.currentIcon, color: state.myColor, token: state.myToken });
  });

  btnJoin?.addEventListener('click', () => {
    const name = inputName.value.trim();
    const code = inputRoom.value.trim().toUpperCase();
    if (!name || code.length !== 4) { showError('Nome e/ou código da sala errados seu bêbado!'); return; }
    state.currentName = name;
    socket.emit('joinRoom', { code, playerName: name, icon: state.currentIcon, color: state.myColor, token: state.myToken });
  });

  btnStart?.addEventListener('click', () => {
    socket.emit('startGame', { code: state.currentRoomCode });
  });

  btnNextCard?.addEventListener('click', () => {
    socket.emit('nextCard', { code: state.currentRoomCode });
  });

  // Spells
  const btnUseSpell = document.getElementById('btn-use-spell');
  if (btnUseSpell) {
    btnUseSpell.addEventListener('click', () => {
      if (state.selectedSpellIndex >= 0 && state.mySpells[state.selectedSpellIndex]) {
        const spell = state.mySpells[state.selectedSpellIndex];
        socket.emit('useSpell', { code: state.currentRoomCode, spellId: spell.id });
        state.mySpells.splice(state.selectedSpellIndex, 1);
        renderMySpellBar();
        closeSpellModal();
      }
    });
  }
});
