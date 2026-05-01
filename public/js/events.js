import { socket, state } from './state.js';

export function renderEventCard(card) {
  const cardAction = document.getElementById('card-action');
  const cardEl = document.getElementById('current-card');
  
  cardEl.classList.add('event-card-active');
  setTimeout(() => cardEl.classList.remove('event-card-active'), 2000);

  let html = `<div class="subtext">${card.subtext} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0a0a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3 L18 3 L15.5 19 L8.5 19 Z"/><line x1="7" y1="21" x2="17" y2="21"/><line x1="12" y1="19" x2="12" y2="21"/><line x1="7.5" y1="10" x2="16.5" y2="10" stroke-dasharray="2 1" stroke-opacity="0.6"/></svg></div>`;
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

window.pressEvent = function () {
  if (navigator.vibrate) navigator.vibrate([500]);
  socket.emit('cardAction', { code: state.currentRoomCode, payload: {} });
  const btn = document.getElementById('btn-event-press');
  if (btn) { btn.disabled = true; btn.innerHTML = 'PRESSED!'; btn.classList.add('pressed'); }
};

window.pressColorButton = function (colorKey) {
  if (navigator.vibrate) navigator.vibrate([200]);
  socket.emit('cardAction', { code: state.currentRoomCode, payload: { colorKey } });
  document.querySelectorAll('.btn-color-pick').forEach(btn => {
    btn.disabled = true;
    if (btn.id !== `cbtn-${colorKey}`) btn.classList.add('color-btn-dim');
  });
  const selected = document.getElementById(`cbtn-${colorKey}`);
  if (selected) selected.classList.add('color-btn-selected');
};

window.spinWheel = function () {
  socket.emit('spinWheel', { code: state.currentRoomCode });
  const btn = document.getElementById('btn-spin');
  if (btn) btn.disabled = true;
};
