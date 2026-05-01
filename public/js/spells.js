import { socket, state } from './state.js';

export function renderMySpellBar() {
  const mySpellBar = document.getElementById('my-spell-bar');
  if (!mySpellBar) return;

  const me = state.globalPlayers.find(p => p.id === socket.id);
  const meColor = me ? me.color : '#ffffff';
  const meIcon  = me ? window.renderIcon(me.icon, me.color, 'sm') : '';

  let html = meIcon;
  html += `<div style="flex:1"></div><div style="display:flex;gap:10px">`;

  for (let i = 0; i < 3; i++) {
    const spell = state.mySpells[i];
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

export function openSpellModal(index) {
  state.selectedSpellIndex = index;
  const spell = state.mySpells[index];
  if (!spell) return;
  document.getElementById('spell-modal-title').textContent = spell.name;
  document.getElementById('spell-modal-icon').innerHTML = spell.icon;
  document.getElementById('spell-modal-desc').textContent = spell.description;
  document.getElementById('spell-modal').style.display = 'flex';
}
window.openSpellModal = openSpellModal;

export function closeSpellModal() {
  document.getElementById('spell-modal').style.display = 'none';
}
window.closeSpellModal = closeSpellModal;

export function openSpellGrantedModal(spell) {
  document.getElementById('spell-granted-title').textContent = spell.name;
  document.getElementById('spell-granted-icon').innerHTML = spell.icon;
  document.getElementById('spell-granted-desc').textContent = spell.description;
  document.getElementById('spell-granted-modal').style.display = 'flex';
}
window.openSpellGrantedModal = openSpellGrantedModal;

export function closeSpellGrantedModal() {
  document.getElementById('spell-granted-modal').style.display = 'none';
}
window.closeSpellGrantedModal = closeSpellGrantedModal;
