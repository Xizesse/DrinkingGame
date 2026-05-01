const { fisherYates } = require('../utils');

const betting = {
  setup(room, card, io, code) {
    const activePlayers = room.players.filter(p => !p.disconnected);
    const [player1, player2] = fisherYates([...activePlayers]);

    room.minigame = {
      type: 'betting',
      player1Id: player1.id,
      player2Id: player2.id,
      bets: {},
      winner: null,
    };

    if (io && code) {
      io.to(code).emit('minigameStateUpdate', {
        player1,
        player2,
        challenge: (card.config && card.config.challenge) || 'Desafio',
        maxBet: (card.config && card.config.maxBet) || 5,
      });
    }
  },

  onAction(room, socket, { action, amount, votedFor } = {}, io, code) {
    if (!room.minigame) return { done: false };
    const mg = room.minigame;

    if (action === 'place_bet') {
      // Competitors can't bet on themselves
      if (socket.id === mg.player1Id || socket.id === mg.player2Id) return { done: false };
      if (mg.bets[socket.id]) return { done: false };

      const maxBet = 5;
      mg.bets[socket.id] = { amount: Math.min(Math.max(1, Number(amount) || 1), maxBet), votedFor };

      if (io && code) io.to(code).emit('minigameStateUpdate', { bets: mg.bets });

      const bettors = room.players.filter(p => !p.disconnected && p.id !== mg.player1Id && p.id !== mg.player2Id);
      return { done: bettors.length > 0 && bettors.every(p => mg.bets[p.id]) };
    }

    if (action === 'declare_winner') {
      const requester = room.players.find(p => p.id === socket.id);
      if (!requester || !requester.isHost) return { done: false };
      mg.winner = votedFor;
      return { done: true };
    }

    return { done: false };
  },

  getResult(room, card) {
    if (!room.minigame) return { consequence: 'Tempo esgotado! Todos bebem 🍺!' };

    const mg = room.minigame;

    if (!mg.winner) {
      return { consequence: 'Tempo esgotado! Ninguém declarou o vencedor. Todos bebem 🍺!' };
    }

    const winner = room.players.find(p => p.id === mg.winner);
    const winnerName = winner
      ? `<span style="color:${winner.color}">${winner.name}</span>`
      : 'O vencedor';

    const lines = [`${winnerName} ganhou o desafio! 🏆`];

    Object.entries(mg.bets).forEach(([playerId, bet]) => {
      const p = room.players.find(x => x.id === playerId);
      if (!p) return;
      const name = `<span style="color:${p.color}">${p.name}</span>`;
      if (bet.votedFor === mg.winner) {
        lines.push(`${name} acertou! Distribui ${bet.amount} goles por quem quiseres 🎉`);
      } else {
        lines.push(`${name} errou! Bebe ${bet.amount} 🍺`);
      }
    });

    return { consequence: lines.join('<br>') };
  },
};

module.exports = betting;
