import { socket, state } from './state.js';
import { shotGlassesHTML } from './utils.js';
import { renderEventCard } from './events.js';
import { renderMiniGameCard } from './minigames.js';

export const cardTypeMap = {
  'Drink Card':      { label: 'CARTA DE BEBIDA', color: '#74b9ff' },
  'Voting Card':     { label: 'VOTAÇÃO',          color: '#a8df65' },
  'Event Card':      { label: 'EVENTO',           color: '#ff6b6b' },
  'Dare Card':       { label: 'DESAFIO',          color: '#a29bfe' },
  'Mini Game Card':  { label: 'MINIJOGO',         color: '#ffe119' },
};

export const cardRenderers = {
  'Drink Card':     renderDrinkCard,
  'Voting Card':    renderVotingCard,
  'Event Card':     renderEventCard,
  'Dare Card':      renderDareCard,
  'Mini Game Card': renderMiniGameCard,
};

export function renderDrinkCard(card) {
  const cardAction = document.getElementById('card-action');
  cardAction.innerHTML = `
    <div class="shot-glasses" style="margin-top:auto;border-top:2px dashed var(--chalk-white);padding-top:12px;">
      ${shotGlassesHTML(card.drinks)}
      <strong style="margin-left:6px;font-size:1.2rem">(${card.drinks})</strong>
    </div>`;
}

export function renderVotingCard(card) {
  const cardAction = document.getElementById('card-action');
  let html = `<div class="timer" id="timer-display">${card.time}</div>`;
  html += `<div class="voting-list">`;
  state.globalPlayers.forEach(p => {
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

export function renderDareCard(card) {
  const cardAction = document.getElementById('card-action');
  const dareActions = document.getElementById('dare-actions');
  const waitingHostText = document.getElementById('waiting-host-text');

  cardAction.innerHTML = `
    <div style="flex:1"></div>
    <div class="shot-glasses" style="margin-bottom:6px">
      ${shotGlassesHTML(card.drinks, 26)}
    </div>`;
  if (state.isLocalHost) {
    dareActions.style.display = 'flex';
  } else {
    waitingHostText.style.display = 'block';
  }
}

window.voteFor = function (id) {
  socket.emit('votePlayer', { code: state.currentRoomCode, targetId: id });
  document.querySelectorAll('.btn-vote').forEach(b => b.classList.remove('selected-vote'));
  const clicked = Array.from(document.querySelectorAll('.btn-vote')).find(b => b.dataset.id === id);
  if (clicked) clicked.classList.add('selected-vote');
};

window.dareResult = function (result) {
  socket.emit('dareResult', { code: state.currentRoomCode, result });
};
