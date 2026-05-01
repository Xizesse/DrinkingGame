const impostor = require('./impostor');
const betting  = require('./betting');

const registry = {
  impostor,
  betting,
};

const unknown = {
  setup() {},
  onAction() { return { done: false }; },
  getResult(room, card) { return { consequence: `Minijogo desconhecido: ${card.minigameType}` }; },
};

function getMinigame(type) {
  return registry[type] || unknown;
}

module.exports = { getMinigame };
