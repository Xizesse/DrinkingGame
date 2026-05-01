const { fisherYates } = require('../utils');

const COLOR_DEFS = [
  { key: 'red',    hex: '#ff4747', label: 'VERMELHO' },
  { key: 'green',  hex: '#3cb44b', label: 'VERDE'    },
  { key: 'yellow', hex: '#ffe119', label: 'AMARELO'  },
  { key: 'blue',   hex: '#4363d8', label: 'AZUL'     },
];

const colorButtons = {
  setup(room, card) {
    room.colorPresses = {};
    const shuffled = fisherYates(COLOR_DEFS);
    const correct = shuffled[Math.floor(Math.random() * shuffled.length)];
    room.correctColorKey = correct.key;

    if (card.interactive === 'color_buttons') {
      card.text = `Carrega no botão <strong style="color:${correct.hex}">${correct.label}</strong>`;
      card.colorButtons = shuffled.map(c => ({ key: c.key, hex: c.hex }));
    } else {
      const wrongColors = COLOR_DEFS.filter(c => c.key !== correct.key);
      const titleColor = wrongColors[Math.floor(Math.random() * wrongColors.length)].hex;
      card.text = `Carrega no botão <strong style="color:${titleColor}">${correct.label}</strong>`;

      const labels = shuffled.map(c => c.label);
      let deranged, tries = 0;
      do {
        deranged = fisherYates(labels);
        tries++;
      } while (tries < 20 && deranged.some((lbl, i) => lbl === shuffled[i].label));

      card.colorButtons = shuffled.map((c, i) => {
        const wordActual = COLOR_DEFS.find(d => d.label === deranged[i]);
        const availColors = COLOR_DEFS.filter(d => d.key !== wordActual.key && d.key !== c.key);
        const wordColor = availColors[Math.floor(Math.random() * availColors.length)].hex;
        return { key: c.key, hex: c.hex, word: deranged[i], wordColor };
      });
    }
  },

  onAction(room, socket, { colorKey } = {}) {
    if (!room.colorPresses) room.colorPresses = {};
    if (room.colorPresses[socket.id] !== undefined) return { done: false };
    room.colorPresses[socket.id] = colorKey;
    const connected = room.players.filter(p => !p.disconnected).length;
    return { done: Object.keys(room.colorPresses).length >= connected };
  },

  getResult(room, card) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    const drinkers = activePlayers.filter(p => {
      const pressed = room.colorPresses && room.colorPresses[p.id];
      return pressed === undefined || pressed !== room.correctColorKey;
    });

    if (drinkers.length === 0) return { consequence: 'Toda a gente acertou! Ninguém bebe! 🎉' };

    const names = drinkers.map(p => `<span style="color:${p.color}">${p.name}</span>`).join(', ');
    const verb  = drinkers.length === 1 ? 'errou'  : 'erraram';
    const drink = drinkers.length === 1 ? 'Bebe'   : 'Bebam';
    return { consequence: `${names} ${verb} o botão! ${drink} 🍺(${card.drinks})` };
  },
};

module.exports = colorButtons;
