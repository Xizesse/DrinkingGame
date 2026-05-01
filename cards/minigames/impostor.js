const { fisherYates } = require('../utils');

const impostor = {
  setup(room, card, io, code) {
    // For now, hardcode the pair to Normal / IMPOSTOR
    const [realWord, impostorWord] = ['Normal', 'IMPOSTOR'];

    const activePlayers = room.players.filter(p => !p.disconnected);
    const shuffled = fisherYates([...activePlayers]);
    const impostorPlayer = shuffled[0];

    room.minigame = {
      type: 'impostor',
      impostorId: impostorPlayer.id,
      realWord,
      impostorWord,
    };

    activePlayers.forEach(p => {
      const word = p.id === impostorPlayer.id ? impostorWord : realWord;
      if (p.id && io) io.to(p.id).emit('minigamePlayerData', { word });
    });
  },

  onAction(room, socket, { action } = {}, io, code) {
    // Word reveal is now purely local/client-side, no server state needed
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
      consequence: `${name} era o impostor! A palavra deles era "<strong>${impostorWord}</strong>" enquanto os outros tinham "<strong>${realWord}</strong>". Bebe 🍺(${card.drinks})!`,
    };
  },
};

module.exports = impostor;
