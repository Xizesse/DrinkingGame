const impostor = require('./impostor');
const rps      = require('./rps');

const registry = {
  impostor,
  rps,
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
