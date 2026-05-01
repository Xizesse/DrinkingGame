const press = {
  setup(room) {
    room.presses = [];
  },

  onAction(room, socket) {
    if (!room.presses) room.presses = [];
    if (room.presses.find(p => p.id === socket.id)) return { done: false };
    room.presses.push({ id: socket.id, time: Date.now() });
    room.presses.sort((a, b) => a.time - b.time);
    if (room.currentCard && room.currentCard.interactive === 'press') {
      const connected = room.players.filter(p => !p.disconnected).length;
      return { done: room.presses.length >= connected };
    }
    return { done: false };
  },

  getResult(room, card) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    let consequence;

    if (card.interactive === 'press') {
      if (room.presses.length === 0) {
        consequence = `Ninguém clicou? Todos bebem 🍺(${card.drinks})!`;
      } else if (room.presses.length < activePlayers.length) {
        const names = activePlayers
          .filter(p => !room.presses.find(x => x.id === p.id))
          .map(p => `<span style="color:${p.color}">${p.name}</span>`)
          .join(', ');
        consequence = `Muito devagar! ${names}: estão muito bêbedos, bebam 🍺(${card.drinks})`;
      } else if (Math.random() > 0.5) {
        const p = room.players.find(x => x.id === room.presses[room.presses.length - 1].id);
        consequence = p
          ? `Mais lento <span style="color:${p.color}">${p.name}</span>: Estás muito bêbedo, bebe 🍺(${card.drinks})`
          : `O mais lento foi rápido a sair! Bebe quem estava mais devagar 🍺(${card.drinks})`;
      } else {
        const p = room.players.find(x => x.id === room.presses[0].id);
        consequence = p
          ? `Mais rápido <span style="color:${p.color}">${p.name}</span>: Estás muito sóbrio, bebe 🍺(${card.drinks + 2})`
          : `O mais rápido saiu do jogo! Bebe quem estava mais à frente 🍺(${card.drinks + 2})`;
      }
    } else {
      if (room.presses.length > 0) {
        const names = room.presses
          .map(x => {
            const p = room.players.find(pl => pl.id === x.id);
            return `<span style="color:${p.color}">${p.name}</span>`;
          })
          .join(', ');
        consequence = `${names} não aguentou e carregou! Bebam 🍺(${card.drinks})`;
      } else {
        consequence = 'Ninguém clicou! Muito bem, ninguém bebe!';
      }
    }
    return { consequence };
  },
};

module.exports = press;
