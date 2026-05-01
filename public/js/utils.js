export function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('screen-active'));
  screen.classList.add('screen-active');
}

export function showError(msg) {
  const errorMsg = document.getElementById('error-message');
  if (!errorMsg) return;
  errorMsg.textContent = msg;
  setTimeout(() => errorMsg.textContent = '', 3000);
}

export function playBang() {
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

export function shotGlassSVG(size = 22, color = '#e9e9e9') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
    stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3 L18 3 L15.5 19 L8.5 19 Z"/>
    <line x1="7" y1="21" x2="17" y2="21"/>
    <line x1="12" y1="19" x2="12" y2="21"/>
    <line x1="7.5" y1="10" x2="16.5" y2="10" stroke-dasharray="2 1" stroke-opacity="0.6"/>
  </svg>`;
}

export function shotGlassesHTML(n, size = 22) {
  return Array.from({ length: Math.min(n, 5) })
    .map(() => shotGlassSVG(size))
    .join('');
}

window.renderIcon = function (emoji, color, sizeClass = '') {
  let cleanEmoji = (emoji && emoji.includes('<img')) ? '🍺' : emoji;
  return `<div class="p-icon-circle ${sizeClass}" style="background-color:${color || '#ffffff'}">${cleanEmoji || '🍺'}</div>`;
};
