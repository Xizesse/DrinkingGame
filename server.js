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
const socketMap = {};

// Colors Database
const chalkColors = [
  '#e6194b', // Red
  '#3cb44b', // Green
  '#ffe119', // Yellow
  '#4363d8', // Blue
  '#f58231', // Orange
  '#911eb4', // Purple
  '#42d4f4', // Cyan
  '#f032e6', // Pink
  '#bfef45', // Lime
  '#9a6324', // Brown
  '#469990', // Teal
  '#ffffff'  // White
];

// Spells Database
const spells = [
  { id: 'shield', icon: '🛡️', name: 'Shield', description: 'Nao tens que beber esta' },
  { id: 'reverse', icon: '🔄', name: 'Reverse', description: 'Faz beber quem te mandou beber' },
  { id: 'double', icon: '✖️2️⃣', name: 'Double', description: 'Duplica os goles que mandas alguem beber' }
];

// Helper to resolve {playerN} and {drinks} tags on the server for consistency
function resolveCardTags(card, players) {
  if (!card.text) return;

  const playerTags = card.text.match(/\{player[0-9]*\}/g) || [];
  const uniqueTags = [...new Set(playerTags)];
  const shuffled = [...players].sort(() => 0.5 - Math.random());

  uniqueTags.forEach((tag, idx) => {
    const p = shuffled[idx % shuffled.length];
    const replacement = `<span style="color: ${p.color || '#fff'}"><strong>${p.name}</strong></span>`;
    card.text = card.text.split(tag).join(replacement);
    if (card.subtext) card.subtext = card.subtext.split(tag).join(replacement);
    if (card.consequence) card.consequence = card.consequence.split(tag).join(replacement);
    if (card.consequences) {
      card.consequences = card.consequences.map(c => c.split(tag).join(replacement));
    }

    if (tag === '{player}' || tag === '{player1}') {
      card.targetPlayer = p;
    }
  });

  const drinkStr = `<strong>${card.drinks}</strong>`;
  card.text = card.text.split('{drinks}').join(drinkStr);
  if (card.subtext) card.subtext = card.subtext.split('{drinks}').join(drinkStr);
  if (card.consequence) card.consequence = card.consequence.split('{drinks}').join(drinkStr);
  if (card.consequences) {
    card.consequences = card.consequences.map(c => c.split('{drinks}').join(drinkStr));
  }
}

function drawNextCard(code, io) {
  const room = rooms[code];
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);

  const nextCard = getRandomCard();
  resolveCardTags(nextCard, room.players);
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
    const activePlayers = room.players.filter(pl => !pl.disconnected);
    const pool = activePlayers.length > 0 ? activePlayers : room.players;
    const p = pool[Math.floor(Math.random() * pool.length)];
    nextCard.targetPlayer = p;
    const beerEmojis = '🍺'.repeat(nextCard.drinks);
    const coloredName = `<span style="color: ${p.color || '#ffffff'}">${p.name}</span>`;
    nextCard.text = nextCard.text.replace('{player}', coloredName).replace('{drinks}', beerEmojis);
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
  const activePlayers = room.players.filter(p => !p.disconnected);
  let consequenceText = "";

  if (!card.interactive) {
    consequenceText = card.subtext || "Acabou o tempo! Bebam todos para compensar!";
  } else if (card.interactive === 'press') {
    if (room.presses.length === 0) {
      consequenceText = `Ninguém clicou? Todos bebem 🍺(${card.drinks})!`;
    } else if (room.presses.length < activePlayers.length) {
      const didNotPressIds = activePlayers.filter(p => !room.presses.find(x => x.id === p.id)).map(p => p.id);
      const didNotPressNames = didNotPressIds.map(id => {
        const p = room.players.find(x => x.id === id);
        return `<span style="color: ${p.color}">${p.name}</span>`;
      }).join(', ');
      consequenceText = `Muito devagar! ${didNotPressNames}: estão muito bêbedos, bebam 🍺(${card.drinks})`;
    } else {
      const r = Math.random();
      if (r > 0.5) {
        const slowest = room.presses[room.presses.length - 1];
        const slowestPlayer = room.players.find(p => p.id === slowest.id);
        consequenceText = `Mais lento <span style="color: ${slowestPlayer.color}">${slowestPlayer.name}</span>: Estás muito bêbedo, bebe 🍺(${card.drinks})`;
      } else {
        const fastest = room.presses[0];
        const fastestPlayer = room.players.find(p => p.id === fastest.id);
        consequenceText = `Mais rápido <span style="color: ${fastestPlayer.color}">${fastestPlayer.name}</span>: Estás muito sóbrio, bebe 🍺(${card.drinks + 2})`;
      }
    }
  } else if (card.interactive === 'dont_press') {
    if (room.presses.length > 0) {
      const pressedNames = room.presses.map(x => {
        const p = room.players.find(pl => pl.id === x.id);
        return `<span style="color: ${p.color}">${p.name}</span>`;
      }).join(', ');
      consequenceText = `${pressedNames} não aguentou e carregou! Bebam 🍺(${card.drinks})`;
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

function getAvailableColor(room) {
  const takenColors = room.players.map(p => p.color);
  for (const color of chalkColors) {
    if (!takenColors.includes(color)) return color;
  }
  return chalkColors[Math.floor(Math.random() * chalkColors.length)]; // Fallback
}

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Provide the current configuration config to the frontend immediately
  try {
    const liveConfig = require('./config.json');
    socket.emit('serverConfig', liveConfig);
  } catch (e) { }

  socket.on('reconnectAttempt', ({ token }) => {
    let foundCode = null;
    let foundPlayer = null;
    for (const code in rooms) {
      for (const p of rooms[code].players) {
        if (p.token === token) {
          foundCode = code;
          foundPlayer = p;
          break;
        }
      }
      if (foundPlayer) break;
    }

    if (foundPlayer) {
      socketMap[socket.id] = { code: foundCode, token };
      foundPlayer.id = socket.id;
      foundPlayer.disconnected = false;
      socket.join(foundCode);

      socket.emit('reconnected', { room: rooms[foundCode], player: foundPlayer });
      io.to(foundCode).emit('playerStatusUpdate', rooms[foundCode].players);

      if (foundPlayer.isHost && rooms[foundCode].status === 'playing') {
        io.to(foundCode).emit('hostReconnected');
      }
    } else {
      socket.emit('reconnectFailed');
    }
  });

  socket.on('createRoom', ({ playerName, icon, color, token }) => {
    let code = generateRoomCode();
    // Ensure uniqueness
    while (rooms[code]) {
      code = generateRoomCode();
    }

    const initialColor = color && !rooms[code].players.some(p => p.color === color) ? color : chalkColors[Math.floor(Math.random() * chalkColors.length)];

    rooms[code] = {
      id: code,
      players: [{ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: true, token, disconnected: false }],
      status: 'lobby'
    };

    socketMap[socket.id] = { code, token };
    socket.join(code);
    socket.emit('roomCreated', rooms[code]);
  });

  socket.on('joinRoom', ({ code, playerName, icon, color, token }) => {
    code = code.toUpperCase();
    if (rooms[code]) {
      if (rooms[code].status === 'playing') {
        socket.emit('error', { message: 'Este jogo já começou!' });
        return;
      }
      const assignedColor = (color && !rooms[code].players.some(p => p.color === color)) ? color : getAvailableColor(rooms[code]);
      rooms[code].players.push({ id: socket.id, name: playerName, icon: icon, color: assignedColor, isHost: false, token, disconnected: false });
      socketMap[socket.id] = { code, token };

      socket.join(code);
      socket.emit('roomJoined', rooms[code]);
      socket.to(code).emit('playerJoined', rooms[code].players);
    } else {
      socket.emit('error', { message: 'Sala não encontrada' });
    }
  });

  socket.on('joinTestRoom', ({ playerName, icon, color, token }) => {
    let code = "TEST";
    if (!rooms[code]) {
      const initialColor = color || chalkColors[Math.floor(Math.random() * chalkColors.length)];
      rooms[code] = {
        id: code,
        players: [{ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: true, token, disconnected: false }],
        status: 'lobby'
      };
      socketMap[socket.id] = { code, token };
      socket.join(code);
      socket.emit('roomCreated', rooms[code]);
    } else {
      const initialColor = (color && !rooms[code].players.some(p => p.color === color)) ? color : getAvailableColor(rooms[code]);
      rooms[code].players.push({ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: false, token, disconnected: false });
      socketMap[socket.id] = { code, token };
      socket.join(code);
      socket.emit('roomJoined', rooms[code]);
      socket.to(code).emit('playerJoined', rooms[code].players);
    }
  });

  socket.on('startGame', ({ code }) => {
    code = code.toUpperCase();
    if (rooms[code] && rooms[code].players.length >= 2) {
      rooms[code].status = 'playing';
      io.to(code).emit('gameStarted');
      drawNextCard(code, io);
    } else if (rooms[code] && rooms[code].players.length < 2) {
      socket.emit('error', { message: 'Precisas de pelo menos 2 jogadores!' });
    }
  });

  socket.on('nextCard', ({ code }) => {
    code = code.toUpperCase();
    drawNextCard(code, io);
  });

  socket.on('updatePlayerCustomization', ({ code, icon, color }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.status === 'lobby') {
      const p = room.players.find(pl => pl.id === socket.id);
      const isTaken = room.players.some(pl => pl.id !== socket.id && pl.color === color);
      if (p && !isTaken) {
        p.icon = icon;
        p.color = color;
        io.to(code).emit('playerJoined', room.players);
      }
    }
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
        room.presses.sort((a, b) => a.time - b.time);
        if (room.currentCard.interactive === 'press' && room.presses.length >= room.players.length) {
          clearInterval(room.timerInterval);
          finishEvent(code, io);
        }
      }
    }
  });

  socket.on('dareResult', ({ code, result, targetId }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (room && room.currentCard && room.currentCard.type === 'Voting Card') {
      const p = room.players.find(pl => pl.id === targetId);
      if (p) {
        io.to(code).emit('cardResults', { stats: [], consequence: `${p.name} usou Reverse! Anulando Votação 🔄` });
      }
    } else if (room && room.currentCard && room.currentCard.type === 'Dare Card') {
      const p = room.currentCard.targetPlayer;

      if (result === 'did_it') {
        // Skip emitting cardResults for 'did_it' as requested - go straight to next card (via host)
        // We still grant spells

        try {
          const liveConfig = require('./config.json');
          if (liveConfig.features && liveConfig.features.spells) {
            const spellProbability = liveConfig.spellProbability !== undefined ? liveConfig.spellProbability : 0.3;
            if (Math.random() < spellProbability) {
              const randomSpell = spells[Math.floor(Math.random() * spells.length)];
              io.to(p.id).emit('spellGranted', randomSpell);
            }
          }
        } catch (e) { }
      }

      if (result === 'drank') {
        try {
          const liveConfig = require('./config.json');
          if (liveConfig.features && liveConfig.features.spinWheel) {
            const wheelProbability = liveConfig.wheelProbability !== undefined ? liveConfig.wheelProbability : 0.5;
            if (Math.random() < wheelProbability) {
              room.wheelPlayer = p;
              room.wheelDrinks = room.currentCard.drinks;
              io.to(code).emit('showWheel', { targetPlayer: p });
              return;
            }
          }
        } catch (e) { }

        // Skip cardResults for 'drank' unless wheel kicks in
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
