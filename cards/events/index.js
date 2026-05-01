const press = require('./press');
const colorButtons = require('./colorButtons');

const registry = {
  press,
  dont_press: press,
  color_buttons: colorButtons,
  color_buttons_stroop: colorButtons,
};

const none = {
  setup() {},
  onAction() { return { done: false }; },
  getResult(_room, card) {
    return { consequence: card.subtext || 'Acabou o tempo! Bebam todos para compensar!' };
  },
};

function getEvent(interactive) {
  return registry[interactive] || none;
}

module.exports = { getEvent };
