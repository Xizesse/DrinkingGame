const { fisherYates } = require('../utils');

const rps = {
  setup(room, card, io, code) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    if (activePlayers.length < 2) return;

    const shuffled = fisherYates([...activePlayers]);
    const player1 = shuffled[0];
    const player2 = shuffled[1];

    room.minigame = {
      type: 'rps',
      phase: 'betting',
      player1: { id: player1.id, name: player1.name, color: player1.color, icon: player1.icon },
      player2: { id: player2.id, name: player2.name, color: player2.color, icon: player2.icon },
      maxBet: card.config?.maxBet || 5,
      bets: {},
      lockedPlayers: [],
      winnerId: null
    };

    const p1Name = `<span style="color:${player1.color}"><strong>${player1.name}</strong></span>`;
    const p2Name = `<span style="color:${player2.color}"><strong>${player2.name}</strong></span>`;
    card.text = `Pedra Papel Tesoura entre ${p1Name} e ${p2Name}. Façam as vossas apostas!`;

    io.to(code).emit('minigameStateUpdate', room.minigame);
  },

  onAction(room, socket, payload, io, code) {
    const { action, amount, votedFor } = payload;
    if (!room.minigame) return { done: false };

    if (action === 'toggle_lock' && room.minigame.phase === 'betting') {
      const idx = room.minigame.lockedPlayers.indexOf(socket.id);
      if (idx > -1) {
        room.minigame.lockedPlayers.splice(idx, 1);
      } else {
        room.minigame.lockedPlayers.push(socket.id);
        if (!room.minigame.bets[socket.id]) {
          room.minigame.bets[socket.id] = { amount: 0, votedFor: null };
        }
      }

      const activePlayers = room.players.filter(p => !p.disconnected);
      if (room.minigame.lockedPlayers.length >= activePlayers.length) {
        room.minigame.phase = 'playing';
        io.to(code).emit('minigameStateUpdate', { phase: 'playing' });
      } else {
        io.to(code).emit('minigameStateUpdate', { lockedPlayers: room.minigame.lockedPlayers, bets: room.minigame.bets });
      }
    }

    if (action === 'place_bet' && room.minigame.phase === 'betting') {
      const idx = room.minigame.lockedPlayers.indexOf(socket.id);
      if (idx > -1) room.minigame.lockedPlayers.splice(idx, 1);

      room.minigame.bets[socket.id] = { amount: Math.abs(amount || 0), votedFor };
      io.to(code).emit('minigameStateUpdate', { bets: room.minigame.bets, lockedPlayers: room.minigame.lockedPlayers });
    }

    if (action === 'declare_winner' && room.minigame.phase === 'playing') {
      const player = room.players.find(p => p.id === socket.id);
      if (!player || !player.isHost) return { done: false };

      room.minigame.winnerId = votedFor;
      return { done: true };
    }

    return { done: false };
  },

  getResult(room, card) {
    if (!room.minigame || !room.minigame.winnerId) return { consequence: 'Desafio cancelado!' };

    const { player1, player2, winnerId, bets } = room.minigame;
    const loserId = winnerId === player1.id ? player2.id : player1.id;

    const playerScores = new Map();

    Object.entries(bets).forEach(([playerId, bet]) => {
      const p = room.players.find(x => x.id === playerId);
      if (!p) return;
      let change = 0;
      if (bet.votedFor === loserId) change = -bet.amount;
      else if (bet.votedFor === winnerId) change = bet.amount;
      playerScores.set(playerId, (playerScores.get(playerId) || 0) + change);
    });

    const drinks = [];
    const gives = [];
    playerScores.forEach((score, playerId) => {
      const p = room.players.find(x => x.id === playerId);
      if (!p || score === 0) return;
      if (score < 0) drinks.push({ name: p.name, color: p.color, icon: p.icon, amount: Math.abs(score) });
      else           gives.push({ name: p.name, color: p.color, icon: p.icon, amount: score });
    });

    return { consequence: `[BET_RESULTS]:${JSON.stringify({ drinks, gives })}` };
  }
};

module.exports = rps;
