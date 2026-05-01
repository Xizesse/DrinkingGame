const { fisherYates } = require('../utils');
const impostorData = require('../impostor_data.json');

const impostor = {
  setup(room, card, io, code) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    if (activePlayers.length < 2) return; 

    // Pick a random category
    const categories = Object.keys(impostorData);
    const category = categories[Math.floor(Math.random() * categories.length)];
    const words = impostorData[category];
    const realWord = words[Math.floor(Math.random() * words.length)];
    const impostorWord = "Tu és o Impostor";

    const shuffled = fisherYates([...activePlayers]);
    const impostorPlayer = shuffled[0];
    const startingPlayer = shuffled[shuffled.length - 1]; 

    room.minigame = {
      type: 'impostor',
      impostorId: impostorPlayer.id,
      realWord,
      impostorWord,
      category,
    };

    // Update card text with category and starting player
    const startName = `<span style="color: ${startingPlayer.color || '#fff'}"><strong>${startingPlayer.name}</strong></span>`;
    card.text = `
      <div class="mg-impostor-container">
        <div class="mg-impostor-title">O Impostor</div>
        <div class="mg-impostor-category">Categoria: <strong>${category}</strong></div>
        <div class="mg-impostor-rules">
          Impostor, descobre a palavra secreta<br>
          Restantes, votem em maioria no impostor
        </div>
        <div class="mg-impostor-start">Cada um diz uma palavra. ${startName} começa</div>
      </div>
    `;

    activePlayers.forEach(p => {
      const word = p.id === impostorPlayer.id ? impostorWord : realWord;
      if (p.id && io) io.to(p.id).emit('minigamePlayerData', { word, category });
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
