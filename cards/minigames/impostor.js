const { fisherYates } = require('../utils');

const impostor = {
  setup(room, card, io, code) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    if (activePlayers.length < 2) return; // Need at least 2 to have an impostor

    // Pick a random pair from config
    const pairs = card.config?.wordPairs || [['Normal', 'Anormal']];
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    const realWord = pair[Math.floor(Math.random() * pair.length)];
    const impostorWord = "Tu és o Impostor";

    const shuffled = fisherYates([...activePlayers]);
    const impostorPlayer = shuffled[0];
    const startingPlayer = shuffled[shuffled.length - 1]; // Someone else starts

    room.minigame = {
      type: 'impostor',
      impostorId: impostorPlayer.id,
      realWord,
      impostorWord,
    };

    // Update card text with the starting player
    const startName = `<span style="color: ${startingPlayer.color || '#fff'}"><strong>${startingPlayer.name}</strong></span>`;
    card.text = `Diz uma palavra relacionada com a palavra secreta. O teu objetivo é encontrar o impostor. Começa o ${startName}`;

    activePlayers.forEach(p => {
      const word = p.id === impostorPlayer.id ? impostorWord : realWord;
      if (p.id && io) io.to(p.id).emit('minigamePlayerData', { word });
    });
  },

  onAction(room, socket, { action } = {}, io, code) {
    return { done: false };
  },

  getResult(room, card) {
    if (!room.minigame) return { consequence: 'Jogo terminado!' };

    const { impostorId, impostorWord, realWord } = room.minigame;
    const impostorPlayer = room.players.find(p => p.id === impostorId);
    const name = impostorPlayer
      ? `<span style="color:${impostorPlayer.color}">${impostorPlayer.name}</span>`
      : 'O impostor';

    return {
      consequence: `${name} era o impostor! A palavra secreta era "<strong>${realWord}</strong>". Bebe 🍺(${card.drinks})!`,
    };
  },
};

module.exports = impostor;
