const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getRandomCard } = require('./cards');
const config = require('./config.json');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory store for rooms
const rooms = {};

// Spells Database
const spells = [
  { id: 'shield', icon: '🛡️', name: 'Shield', description: 'Nao tens que beber esta' },
  { id: 'reverse', icon: '🔄', name: 'Reverse', description: 'Faz beber quem te mandou beber' },
  { id: 'double', icon: '✖️2️⃣', name: 'Double', description: 'Duplica os goles que mandas alguem beber' }
];

function drawNextCard(code, io) {
  const room = rooms[code];
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);

  const nextCard = getRandomCard();
  room.currentCard = nextCard;

  if (nextCard.type === 'Voting Card') {
    room.votes = {};
    room.timeLeft = nextCard.time;
    io.to(code).emit('timerUpdate', room.timeLeft);
    room.timerInterval = setInterval(() => {
      room.timeLeft--;
      io.to(code).emit('timerUpdate', room.timeLeft);
      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        finishVoting(code, io);
      }
    }, 1000);
  } else if (nextCard.type === 'Event Card') {
    room.presses = []; // track button press timestamps
    room.timeLeft = nextCard.time;
    io.to(code).emit('timerUpdate', room.timeLeft);
    room.timerInterval = setInterval(() => {
      room.timeLeft--;
      io.to(code).emit('timerUpdate', room.timeLeft);
      if (room.timeLeft <= 0) {
        clearInterval(room.timerInterval);
        finishEvent(code, io);
      }
    }, 1000);
  } else if (nextCard.type === 'Dare Card' && room.players.length > 0) {
    const p = room.players[Math.floor(Math.random() * room.players.length)];
    nextCard.targetPlayer = p;
    nextCard.text = nextCard.text.replace('{player}', p.name).replace('{drinks}', nextCard.drinks);
  }

  io.to(code).emit('newCard', nextCard);
}

function finishVoting(code, io) {
  const room = rooms[code];
  if (!room) return;

  const results = {};
  const voters = {};

  room.players.forEach(p => {
    results[p.id] = 0;
    voters[p.id] = [];
  });

  for (const [voterId, targetId] of Object.entries(room.votes || {})) {
    if (results[targetId] !== undefined) {
      results[targetId]++;
      const voterPlayer = room.players.find(p => p.id === voterId);
      if (voterPlayer) {
        voters[targetId].push(voterPlayer);
      }
    }
  }

  const stats = room.players.map(p => ({
    player: p,
    count: results[p.id],
    voters: voters[p.id]
  })).sort((a, b) => b.count - a.count);

  io.to(code).emit('cardResults', { stats, consequence: room.currentCard.consequence });
}

function finishEvent(code, io) {
  const room = rooms[code];
  if (!room) return;
  const card = room.currentCard;
  let consequenceText = "";

  if (!card.interactive) {
    consequenceText = card.subtext || "Acabou o tempo!";
  } else if (card.interactive === 'press') {
    if (room.presses.length === 0) {
      consequenceText = "Ninguém clicou? Todos bebem!";
    } else if (room.presses.length < room.players.length) {
      const didNotPressIds = room.players.filter(p => !room.presses.find(x => x.id === p.id)).map(p => p.id);
      const didNotPressNames = didNotPressIds.map(id => room.players.find(p => p.id === id).name).join(', ');
      consequenceText = `Too slow! (${didNotPressNames}): you are too drunk, drink 🍺(1)`;
    } else {
      const r = Math.random();
      if (r > 0.5) {
        const slowest = room.presses[room.presses.length - 1];
        const slowestPlayer = room.players.find(p => p.id === slowest.id);
        consequenceText = `Slowest (${slowestPlayer.name}): You are too drunk, drink 🍺(1)`;
      } else {
        const fastest = room.presses[0];
        const fastestPlayer = room.players.find(p => p.id === fastest.id);
        consequenceText = `Fastest (${fastestPlayer.name}): You are too sober, drink 🍺(5)`;
      }
    }
  } else if (card.interactive === 'dont_press') {
    if (room.presses.length > 0) {
      const pressedNames = room.presses.map(x => room.players.find(p => p.id === x.id).name).join(', ');
      consequenceText = `${pressedNames} pressed it! You have to drink! 🍺(1)`;
    } else {
      consequenceText = "Ninguém clicou! Muito bem, ninguém bebe!";
    }
  }

  io.to(code).emit('cardResults', { stats: [], consequence: consequenceText });
}

// Helper to generate a random 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', ({ playerName, icon }) => {
    let code = generateRoomCode();
    // Ensure uniqueness
    while (rooms[code]) {
      code = generateRoomCode();
    }

    rooms[code] = {
      id: code,
      players: [{ id: socket.id, name: playerName, icon: icon, isHost: true }],
      status: 'lobby'
    };

    socket.join(code);
    socket.emit('roomCreated', rooms[code]);
  });

  socket.on('joinRoom', ({ code, playerName, icon }) => {
    code = code.toUpperCase();
    if (rooms[code]) {
      if (rooms[code].status === 'playing') {
        socket.emit('error', { message: 'This game has already started!' });
        return;
      }
      rooms[code].players.push({ id: socket.id, name: playerName, icon: icon, isHost: false });
      socket.join(code);
      socket.emit('roomJoined', rooms[code]);
      socket.to(code).emit('playerJoined', rooms[code].players);
    } else {
      socket.emit('error', { message: 'Room not found' });
    }
  });

  socket.on('startGame', ({ code }) => {
    code = code.toUpperCase();
    if (rooms[code] && rooms[code].players.length >= 2) {
      rooms[code].status = 'playing';
      io.to(code).emit('gameStarted');
      drawNextCard(code, io);
    } else if (rooms[code] && rooms[code].players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players!' });
    }
  });

  socket.on('nextCard', ({ code }) => {
    code = code.toUpperCase();
    drawNextCard(code, io);
  });

  socket.on('votePlayer', ({ code, targetId }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.currentCard && room.currentCard.type === 'Voting Card') {
      if (!room.votes) room.votes = {};
      room.votes[socket.id] = targetId;

      if (Object.keys(room.votes).length >= room.players.length) {
        clearInterval(room.timerInterval);
        finishVoting(code, io);
      }
    }
  });

  socket.on('eventPress', ({ code }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.currentCard && room.currentCard.type === 'Event Card' && room.currentCard.interactive) {
      if (!room.presses) room.presses = [];
      if (!room.presses.find(p => p.id === socket.id)) {
        room.presses.push({ id: socket.id, time: Date.now() });
        if (room.currentCard.interactive === 'press' && room.presses.length >= room.players.length) {
          clearInterval(room.timerInterval);
          finishEvent(code, io);
        }
      }
    }
  });

  socket.on('dareResult', ({ code, result }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.currentCard && room.currentCard.type === 'Dare Card') {
      const p = room.currentCard.targetPlayer;
      let msg = "";
      if (result === 'did_it') msg = `${p.name} aceitou o desafio! 🏆`;
      if (result === 'drank') msg = `${p.name} bebeu e recusou o desafio! 🍺(${room.currentCard.drinks})`;
      io.to(code).emit('cardResults', { stats: [], consequence: msg });
    }
  });

  socket.on('dareResult', ({ code, result }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.currentCard && room.currentCard.type === 'Dare Card') {
      const p = room.currentCard.targetPlayer;
      if (result === 'did_it') {
        io.to(code).emit('cardResults', { stats: [], consequence: `${p.name} aceitou o desafio! 🏆` });

        const spellProbability = config.spellProbability !== undefined ? config.spellProbability : 0.3;
        if (Math.random() < spellProbability) {
          const randomSpell = spells[Math.floor(Math.random() * spells.length)];
          io.to(p.id).emit('spellGranted', randomSpell);
        }
      }
      if (result === 'drank') {
        const wheelProbability = config.wheelProbability !== undefined ? config.wheelProbability : 0.5;
        if (Math.random() < wheelProbability) {
          room.wheelPlayer = p;
          room.wheelDrinks = room.currentCard.drinks;
          io.to(code).emit('showWheel', { targetPlayer: p });
        } else {
          io.to(code).emit('cardResults', { stats: [], consequence: `${p.name} bebeu e recusou o desafio! 🍺(${room.currentCard.drinks})` });
        }
      }
    }
  });

  socket.on('spinWheel', ({ code }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.wheelPlayer) {
      const multipliers = [0, 2];
      const mult = multipliers[Math.floor(Math.random() * multipliers.length)];
      io.to(code).emit('wheelSpinning', { multiplier: mult });

      setTimeout(() => {
        const finalDrinks = room.wheelDrinks * mult;
        const consequence = mult === 0 ? `${room.wheelPlayer.name} teve sorte na roda! Safou-se! 🎉` : `OOF! O dobro! ${room.wheelPlayer.name} bebe ${finalDrinks}! 🍺`;
        io.to(code).emit('cardResults', { stats: [], consequence });
        room.wheelPlayer = null;
        room.wheelDrinks = 0;
      }, 3000);
    }
  });

  socket.on('useSpell', ({ code, spellId }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room) {
      const p = room.players.find(x => x.id === socket.id);
      const spell = spells.find(s => s.id === spellId);
      if (p && spell) {
        const msg = `✨ ${p.name} usou o feitiço ${spell.name} ${spell.icon}! \n${spell.description}`;
        io.to(code).emit('spellUsed', { player: p, spell, message: msg });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    for (const code in rooms) {
      const room = rooms[code];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) {
          delete rooms[code]; // Destroy empty room
        } else {
          // If host left, reassign host
          if (!room.players.find(p => p.isHost)) {
            room.players[0].isHost = true;
          }
          io.to(code).emit('playerLeft', room.players);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
