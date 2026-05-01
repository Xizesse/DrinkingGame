import { socket, state } from './state.js';

export function renderMiniGameCard(card) {
  const cardAction = document.getElementById('card-action');
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

export function updateImpostorWordBox() {
  const box = document.getElementById('mg-word-box');
  if (!box || !state.myMinigameData) return;
  const word = state.myMinigameData.word;
  const flippedClass = state.myWordRevealed ? 'flipped' : '';
  const btnText = state.myWordRevealed ? 'HIDE CARD' : 'SHOW CARD';

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
  if (!state.myMinigameData) return;
  state.myWordRevealed = !state.myWordRevealed;
  updateImpostorWordBox();
};

export function updateBettingUI() {
  const bettingEl = document.getElementById('mg-betting');
  const betsEl    = document.getElementById('mg-bets');

  if (bettingEl && state.minigameState.player1 && state.minigameState.player2) {
    const { player1, player2, challenge, maxBet = 5 } = state.minigameState;
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
      if (state.isLocalHost) {
        html += `<div class="mg-declare-row">
          <button class="btn-chalk mg-winner-btn" onclick="declareWinner('${player1.id}')">🏆 ${player1.name}</button>
          <button class="btn-chalk mg-winner-btn" onclick="declareWinner('${player2.id}')">🏆 ${player2.name}</button>
        </div>`;
      }
    } else if (!state.myBetPlaced) {
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

  if (betsEl && state.minigameState.bets) {
    const entries = Object.entries(state.minigameState.bets);
    if (entries.length === 0) { betsEl.innerHTML = ''; return; }
    let html = '<div class="mg-bets-list">';
    entries.forEach(([playerId, bet]) => {
      const p = state.globalPlayers.find(x => x.id === playerId);
      const voted = state.globalPlayers.find(x => x.id === bet.votedFor);
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
  if (state.myBetPlaced) return;
  const amount = parseInt(document.getElementById('bet-amount').value) || 1;
  state.myBetPlaced = true;
  socket.emit('minigameAction', { code: state.currentRoomCode, payload: { action: 'place_bet', amount, votedFor } });
  updateBettingUI();
};

window.declareWinner = function (winnerId) {
  socket.emit('minigameAction', { code: state.currentRoomCode, payload: { action: 'declare_winner', votedFor: winnerId } });
};
