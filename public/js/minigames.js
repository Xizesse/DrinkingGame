import { socket, state } from './state.js';
import { shotGlassesHTML } from './utils.js';

export function renderBettingResults(data) {
  let html = '<div class="mg-bet-results">';

  html += '<div class="mg-res-section"><div class="mg-res-title">BEBER</div>';
  data.drinks.forEach(d => {
    html += `
      <div class="mg-res-item">
        ${window.renderIcon(d.icon, d.color, 'sm')}
        <span style="color:${d.color}">${d.name}</span>
        <div class="mg-res-glasses">${shotGlassesHTML(d.amount, 20)}</div>
        <strong>: ${d.amount}</strong>
      </div>`;
  });
  html += '</div>';

  html += '<div class="mg-res-section"><div class="mg-res-title">DISTRIBUIR</div>';
  data.gives.forEach(g => {
    html += `
      <div class="mg-res-item">
        ${window.renderIcon(g.icon, g.color, 'sm')}
        <span style="color:${g.color}">${g.name}</span>
        <div class="mg-res-glasses">${shotGlassesHTML(g.amount, 20)}</div>
        <strong>: ${g.amount}</strong>
      </div>`;
  });
  html += '</div>';

  html += '</div>';
  return html;
}

export function renderMiniGameCard(card) {
  state.currentTugBet = 0;
  
  const cardAction = document.getElementById('card-action');
  let html = '';
  if (card.minigameType === 'impostor') {
    html += `<div id="mg-word-box" class="mg-word-box">
               <div class="subtext">A carregar palavra... 🃏</div>
             </div>`;
    if (state.myMinigameData) {
      setTimeout(updateImpostorWordBox, 0);
    }
  } else if (card.minigameType === 'rps') {
    html += `<div id="mg-rps" class="mg-betting"><div class="subtext">A preparar o desafio... ✂️</div></div>
             <div id="mg-bets" class="mg-bets"></div>`;
    if (state.minigameState && Object.keys(state.minigameState).length > 0) {
      setTimeout(updateRpsUI, 0);
    }
  }
  cardAction.innerHTML = html;
}

export function updateImpostorWordBox() {
  const box = document.getElementById('mg-word-box');
  if (!box || !state.myMinigameData) return;
  const word = state.myMinigameData.word;
  const category = state.myMinigameData.category || '???';
  const flippedClass = state.myWordRevealed ? 'flipped' : '';
  const btnText = state.myWordRevealed ? 'HIDE CARD' : 'SHOW CARD';

  box.innerHTML = `
    <div class="mg-flip-card ${flippedClass}">
      <div class="mg-flip-card-inner" onclick="toggleImpostorReveal()">
        <div class="mg-flip-card-front">?</div>
        <div class="mg-flip-card-back">
          <div class="mg-secret-word">${word}</div>
        </div>
      </div>
    </div>
    <div class="mg-impostor-stakes-outer">
      <span class="win">Impostor ganha: Distribui 5</span><br>
      <span class="loss">Impostor perde: Bebe 5</span>
    </div>
    <button class="mg-reveal-btn" onclick="toggleImpostorReveal()">${btnText}</button>
  `;
}

window.toggleImpostorReveal = function () {
  if (!state.myMinigameData) return;
  state.myWordRevealed = !state.myWordRevealed;
  updateImpostorWordBox();
};

export function updateRpsUI() {
  const rpsEl = document.getElementById('mg-rps');
  if (!rpsEl) return;

  const { player1, player2, phase, bets = {}, lockedPlayers = [] } = state.minigameState;
  if (!player1 || !player2) return;

  let html = '';

  if (phase === 'betting') {
    const isLocked   = lockedPlayers.includes(socket.id);
    const betVal     = state.currentTugBet || 0;
    const displayVal = Math.abs(betVal);
    const color = betVal > 0 ? player1.color : (betVal < 0 ? player2.color : 'var(--chalk-white)');

    html = `
      <div class="subtext">CLICA NOS PLAYERS PARA APOSTAR</div>
      <div class="mg-tug-picker ${isLocked ? 'is-locked' : ''}">
        <div class="mg-tug-player ${betVal > 0 ? 'active' : ''}" onclick="adjustTugBet(1)">
          <div class="mg-icon-btn-box">${window.renderIcon(player1.icon, player1.color, 'md')}</div>
          <span class="mg-tug-label">${player1.name}</span>
        </div>
        <div class="mg-tug-value" style="color:${color}">${displayVal}</div>
        <div class="mg-tug-player ${betVal < 0 ? 'active' : ''}" onclick="adjustTugBet(2)">
          <div class="mg-icon-btn-box">${window.renderIcon(player2.icon, player2.color, 'md')}</div>
          <span class="mg-tug-label">${player2.name}</span>
        </div>
      </div>
      <button class="btn-chalk mg-place-bet-btn ${isLocked ? 'btn-locked' : ''}" onclick="toggleBetLock()">
        ${isLocked ? 'DESBLOQUEAR' : 'BLOQUEAR'}
      </button>
      <div class="subtext" style="margin-top:10px;font-size:0.9rem;opacity:0.7">
        Bloqueados: ${lockedPlayers.length} / ${state.globalPlayers.length}
      </div>
    `;
  } else if (phase === 'playing') {
    html = `
      <div class="mg-challenge-header">Joguem! À melhor de 3 ✂️</div>
      <div class="mg-playing-stage">
        <div class="mg-competitor-col">
          ${window.renderIcon(player1.icon, player1.color, 'lg')}
          <span class="mg-competitor-name" style="color:${player1.color}">${player1.name}</span>
          <div class="mg-voter-bubbles">${renderVoterBubbles(player1.id)}</div>
        </div>
        <div class="mg-vs-playing">VS</div>
        <div class="mg-competitor-col">
          ${window.renderIcon(player2.icon, player2.color, 'lg')}
          <span class="mg-competitor-name" style="color:${player2.color}">${player2.name}</span>
          <div class="mg-voter-bubbles">${renderVoterBubbles(player2.id)}</div>
        </div>
      </div>
    `;

    html += `<div class="mg-declare-winner">`;
    if (state.isLocalHost) {
      html += `
          <p class="subtext">Anfitrião, quem ganhou?</p>
          <div class="mg-winner-buttons">
            <button class="btn-chalk" onclick="declareWinner('${player1.id}')" style="border-color:${player1.color};color:${player1.color}">${player1.name}</button>
            <button class="btn-chalk" onclick="declareWinner('${player2.id}')" style="border-color:${player2.color};color:${player2.color}">${player2.name}</button>
          </div>
      `;
    } else {
      html += `<p class="subtext">A aguardar decisão do anfitrião... ✂️</p>`;
    }
    html += `</div>`;
  }

  rpsEl.innerHTML = html;
}

// Alias kept so socket-listeners import still works
export const updateBettingUI = updateRpsUI;

function renderVoterBubbles(targetId) {
  const bets = state.minigameState.bets || {};
  return Object.entries(bets)
    .filter(([_, bet]) => bet.votedFor === targetId)
    .map(([playerId, bet]) => {
      const p = state.globalPlayers.find(x => x.id === playerId);
      if (!p) return '';
      return `<div class="mg-voter-bubble" style="background:${p.color}" title="${p.name} apostou ${bet.amount}">
                ${window.renderIcon(p.icon, '#000', 'xs')}
                <span class="mg-voter-amount">${bet.amount}</span>
              </div>`;
    }).join('');
}

window.adjustTugBet = function(playerIdx) {
  if (state.minigameState.phase !== 'betting') return;
  const max = state.minigameState.maxBet || 5;
  if (playerIdx === 1) {
    if (state.currentTugBet < max) state.currentTugBet = (state.currentTugBet || 0) + 1;
  } else {
    if (state.currentTugBet > -max) state.currentTugBet = (state.currentTugBet || 0) - 1;
  }
  const votedFor = state.currentTugBet > 0 ? state.minigameState.player1.id : (state.currentTugBet < 0 ? state.minigameState.player2.id : null);
  const amount = Math.abs(state.currentTugBet);
  socket.emit('minigameAction', { code: state.currentRoomCode, payload: { action: 'place_bet', amount, votedFor } });
  updateRpsUI();
};

window.toggleBetLock = function() {
  socket.emit('minigameAction', { code: state.currentRoomCode, payload: { action: 'toggle_lock' } });
};

window.declareWinner = function(winnerId) {
  socket.emit('minigameAction', { code: state.currentRoomCode, payload: { action: 'declare_winner', votedFor: winnerId } });
};
