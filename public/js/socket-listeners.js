import { socket, state } from './state.js';
import { showError, showScreen } from './utils.js';
import { enterLobby, updatePlayersList, renderTopBarPlayers } from './lobby.js';
import { renderMySpellBar, openSpellGrantedModal } from './spells.js';
import { cardTypeMap, cardRenderers } from './cards.js';
import { updateImpostorWordBox, updateBettingUI } from './minigames.js';

export function initSocketListeners() {
  const screenHome  = document.getElementById('home-screen');
  const screenGame  = document.getElementById('game-screen');
  const cardTypeLabel = document.getElementById('card-type-label');
  const cardText = document.getElementById('card-text');
  const cardAction = document.getElementById('card-action');
  const dareActions = document.getElementById('dare-actions');
  const waitingHostText = document.getElementById('waiting-host-text');

  socket.on('reconnected', ({ room, player }) => {
    state.currentRoomCode = room.id;
    state.currentName     = player.name;
    state.isLocalHost     = player.isHost;
    state.mySpells        = [];
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

  socket.on('roomCreated', room => enterLobby(room));
  socket.on('roomJoined',  room => enterLobby(room));
  socket.on('playerJoined', players => updatePlayersList(players));
  socket.on('playerLeft',   players => updatePlayersList(players));
  socket.on('error', err => showError(err.message));

  socket.on('gameStarted', () => {
    showScreen(screenGame);
    renderTopBarPlayers(state.globalPlayers);
    renderMySpellBar();
  });

  socket.on('newCard', card => {
    state.globalCurrentCard = card;
    state.myMinigameData  = null;
    state.minigameState   = {};
    state.myWordRevealed  = false;
    state.myBetPlaced     = false;
    if(dareActions) dareActions.style.display     = 'none';
    if(waitingHostText) waitingHostText.style.display = 'none';

    const typeInfo = cardTypeMap[card.type] || { label: card.type.toUpperCase(), color: '#e9e9e9' };
    if(cardTypeLabel) {
      cardTypeLabel.textContent = typeInfo.label;
      cardTypeLabel.style.color = typeInfo.color;
    }
    if(cardText) cardText.innerHTML = card.text;
    if(cardAction) cardAction.innerHTML = '';

    const renderer = cardRenderers[card.type];
    if (renderer) renderer(card);
  });

  socket.on('minigamePlayerData', data => {
    state.myMinigameData = data;
    if (state.globalCurrentCard && state.globalCurrentCard.minigameType === 'impostor') {
      updateImpostorWordBox();
    }
  });

  socket.on('minigameStateUpdate', ms_state => {
    state.minigameState = { ...state.minigameState, ...ms_state };
    if (!state.globalCurrentCard) return;
    if (state.globalCurrentCard.minigameType === 'betting') updateBettingUI();
  });

  socket.on('timerUpdate', t => {
    const td = document.getElementById('timer-display');
    if (td) td.textContent = t;
  });

  socket.on('cardResults', data => {
    if(dareActions) dareActions.style.display     = 'none';
    if(waitingHostText) waitingHostText.style.display = 'none';

    let consequence = data.consequence || '';
    if (consequence.includes('{drinks}') && state.globalCurrentCard?.drinks) {
      consequence = consequence.replace('{drinks}', `<strong>${state.globalCurrentCard.drinks}</strong>`);
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

    if(cardAction) cardAction.innerHTML = `
      <div class="card-consequence">${consequence} !!</div>
      <div class="stats-list">${statsHtml}</div>`;
  });

  socket.on('showWheel', ({ targetPlayer }) => {
    if(cardText) cardText.textContent = '';
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
    if(cardAction) cardAction.innerHTML = html;
  });

  socket.on('wheelSpinning', ({ multiplier }) => {
    const wheel = document.getElementById('wheel-container');
    if (wheel) {
      let angle = 1800;
      if (multiplier !== 0) angle += 180;
      wheel.style.transform = `rotate(${angle}deg)`;
    }
  });

  socket.on('spellGranted', spell => {
    state.mySpells.push(spell);
    renderMySpellBar();
    openSpellGrantedModal(spell);
  });

  socket.on('spellUsed', ({ message }) => {
    window.showToast(message, 5000);
  });

  socket.on('playerStatusUpdate', players => {
    state.globalPlayers = players;
    renderTopBarPlayers(players);
  });

  socket.on('hostDisconnected', () => {
    const overlay = document.getElementById('host-disconnected-overlay');
    if(overlay) overlay.style.display = 'flex';
  });

  socket.on('hostReconnected', () => {
    const overlay = document.getElementById('host-disconnected-overlay');
    if(overlay) overlay.style.display = 'none';
  });

  socket.on('serverConfig', config => {
    if (config.skipRoom && !state.currentRoomCode) {
      state.currentName = 'Tester_' + Math.floor(Math.random() * 1000);
      socket.emit('quickJoin', { playerName: state.currentName, icon: state.currentIcon, color: state.myColor, token: state.myToken });
    }
  });
}
