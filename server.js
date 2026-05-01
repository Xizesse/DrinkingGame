const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { getRandomCard } = require('./cards/cards');
const { fisherYates } = require('./cards/utils');
const { getEvent } = require('./cards/events');
const { getMinigame } = require('./cards/minigames');
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

  const activePlayers = players.filter(p => !p.disconnected);
  const pool = activePlayers.length > 0 ? activePlayers : players;

  const playerTags = card.text.match(/\{player[0-9]*\}/g) || [];
  const uniqueTags = [...new Set(playerTags)];
  const shuffled = fisherYates(pool);

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

function startTimer(code, io, onExpire) {
  const room = rooms[code];
  io.to(code).emit('timerUpdate', room.timeLeft);
  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(code).emit('timerUpdate', room.timeLeft);
    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      onExpire(code, io);
    }
  }, 1000);
}

function drawNextCard(code, io) {
  const room = rooms[code];
  if (!room) return;

  if (room.timerInterval) clearInterval(room.timerInterval);
  room.eventFinished = false;
  room.votingFinished = false;
  room.minigameFinished = false;
  room.minigame = null;

  const activePlayers = room.players.filter(p => !p.disconnected);
  const playerPool = activePlayers.length > 0 ? activePlayers : room.players;

  let nextCard;
  let uniqueTagCount = 0;
  let attempts = 0;
  do {
    nextCard = getRandomCard();
    uniqueTagCount = new Set((nextCard.text || '').match(/\{player[0-9]*\}/g) || []).size;
    attempts++;
  } while (uniqueTagCount > playerPool.length && attempts < 10);

  resolveCardTags(nextCard, room.players);
  room.currentCard = nextCard;
  
  room.currentRound++;
  if (room.currentRound > room.maxRounds) {
    room.status = 'lobby';
    io.to(code).emit('gameEnded', room);
    return;
  }

  io.to(code).emit('newCard', { 
    card: nextCard, 
    currentRound: room.currentRound, 
    maxRounds: room.maxRounds 
  });

  if (nextCard.type === 'Mini Game Card') {
    const handler = getMinigame(nextCard.minigameType);
    handler.setup(room, nextCard, io, code);
  }

  if (nextCard.type === 'Event Card') {
    const handler = getEvent(nextCard.interactive);
    handler.setup(room, nextCard, io, code);
  }

  if (nextCard.type === 'Voting Card') {
    room.votes = {};
    room.timeLeft = nextCard.time;
    startTimer(code, io, finishVoting);
  } else if (nextCard.type === 'Event Card') {
    room.timeLeft = nextCard.time;
    startTimer(code, io, finishEvent);
  } else if (nextCard.type === 'Mini Game Card') {
    // No timer for minigames anymore
    room.timeLeft = 0;
  }
}

function finishVoting(code, io) {
  const room = rooms[code];
  if (!room || room.votingFinished) return;
  room.votingFinished = true;

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
  if (!room || room.eventFinished) return;
  room.eventFinished = true;

  const card = room.currentCard;
  const handler = getEvent(card.interactive);
  const { consequence } = handler.getResult(room, card);
  io.to(code).emit('cardResults', { stats: [], consequence });
}

function finishMinigame(code, io) {
  const room = rooms[code];
  if (!room || room.minigameFinished) return;
  room.minigameFinished = true;

  const card = room.currentCard;
  const handler = getMinigame(card.minigameType);
  const { consequence } = handler.getResult(room, card);
  io.to(code).emit('cardResults', { stats: [], consequence });
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

const MAX_PLAYERS = 5;

function addFakePlayers(room) {
  try {
    const liveConfig = require('./config.json');
    let numFakes = liveConfig.fakePlayers || 0;
    const currentCount = room.players.length;
    
    if (currentCount + numFakes > MAX_PLAYERS) {
      numFakes = MAX_PLAYERS - currentCount;
    }
    
    if (numFakes <= 0) return;

    const iconList = ['🍺','🍷','🥃','🍸','🍹','🧉','🍶','🍾','🧊','🍻','🥂','🫧'];
    for (let i = 0; i < numFakes; i++) {
      room.players.push({
        id: 'fake_' + Math.random(),
        name: 'Bot_' + (i + 1),
        icon: iconList[Math.floor(Math.random() * iconList.length)],
        color: getAvailableColor(room),
        isHost: false,
        token: 'fake_token_' + Math.random(),
        disconnected: false,
        spells: []
      });
    }
  } catch (e) {}
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
    
    if (token) {
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
    }

    if (foundPlayer) {
      socketMap[socket.id] = { code: foundCode, token };
      foundPlayer.id = socket.id;
      foundPlayer.disconnected = false;
      socket.join(foundCode);

      const room = rooms[foundCode];
      socket.emit('reconnected', { room, player: foundPlayer });
      io.to(foundCode).emit('playerStatusUpdate', room.players);

      if (room.status === 'playing') {
        if (foundPlayer.isHost) io.to(foundCode).emit('hostReconnected');
        if (room.currentCard) {
          socket.emit('newCard', room.currentCard);
          if (room.timeLeft > 0) socket.emit('timerUpdate', room.timeLeft);
        }
      }
    } else {
      socket.emit('reconnectFailed');
    }
  });

  socket.on('createRoom', ({ playerName, icon, color, token }) => {
    playerName = String(playerName || '').substring(0, 8);
    let code = generateRoomCode();
    // Ensure uniqueness
    while (rooms[code]) {
      code = generateRoomCode();
    }

    const initialColor = color || chalkColors[Math.floor(Math.random() * chalkColors.length)];

    rooms[code] = {
      id: code,
      players: [{ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: true, token, disconnected: false, spells: [] }],
      status: 'lobby'
    };

    addFakePlayers(rooms[code]);

    socketMap[socket.id] = { code, token };
    socket.join(code);
    socket.emit('roomCreated', rooms[code]);
  });

  socket.on('joinRoom', ({ code, playerName, icon, color, token }) => {
    playerName = String(playerName || '').substring(0, 8);
    code = code.toUpperCase();
    if (rooms[code]) {
      if (rooms[code].status === 'playing') {
        socket.emit('error', { message: 'Este jogo já começou!' });
        return;
      }
      if (rooms[code].players.length >= MAX_PLAYERS) {
        socket.emit('error', { message: 'Esta sala já está cheia (máx. 5 jogadores)!' });
        return;
      }
      const assignedColor = (color && !rooms[code].players.some(p => p.color === color)) ? color : getAvailableColor(rooms[code]);
      rooms[code].players.push({ id: socket.id, name: playerName, icon: icon, color: assignedColor, isHost: false, token, disconnected: false, spells: [] });
      socketMap[socket.id] = { code, token };

      socket.join(code);
      socket.emit('roomJoined', rooms[code]);
      socket.to(code).emit('playerJoined', rooms[code].players);
    } else {
      socket.emit('error', { message: 'Sala não encontrada' });
    }
  });

  socket.on('quickJoin', ({ playerName, icon, color, token }) => {
    playerName = String(playerName || '').substring(0, 8);
    let code = "QUICK";
    
    // Prevent duplicate joins
    if (socketMap[socket.id]) return;

    if (!rooms[code]) {
      const initialColor = color || chalkColors[Math.floor(Math.random() * chalkColors.length)];
      rooms[code] = {
        id: code,
        players: [{ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: true, token, disconnected: false, spells: [] }],
        status: 'lobby'
      };
      
      addFakePlayers(rooms[code]);
      
      socketMap[socket.id] = { code, token };
      socket.join(code);
      socket.emit('roomCreated', rooms[code]);
    } else {
      if (rooms[code].status === 'playing') {
        socket.emit('error', { message: 'Este jogo já começou!' });
        return;
      }
      
      // Prevent joining if token is already in the room
      if (rooms[code].players.some(p => p.token === token)) return;

      if (rooms[code].players.length >= MAX_PLAYERS) {
        socket.emit('error', { message: 'Esta sala já está cheia (máx. 5 jogadores)!' });
        return;
      }

      const initialColor = (color && !rooms[code].players.some(p => p.color === color)) ? color : getAvailableColor(rooms[code]);
      rooms[code].players.push({ id: socket.id, name: playerName, icon: icon, color: initialColor, isHost: false, token, disconnected: false, spells: [] });
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
      rooms[code].currentRound = 0;
      rooms[code].maxRounds = 30;
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

      const connectedCount = room.players.filter(p => !p.disconnected).length;
      if (Object.keys(room.votes).length >= connectedCount) {
        clearInterval(room.timerInterval);
        finishVoting(code, io);
      }
    }
  });

  socket.on('cardAction', ({ code, payload }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (!room || !room.currentCard || room.currentCard.type !== 'Event Card' || room.eventFinished) return;

    const handler = getEvent(room.currentCard.interactive);
    const { done } = handler.onAction(room, socket, payload || {});
    if (done) {
      clearInterval(room.timerInterval);
      finishEvent(code, io);
    }
  });

  socket.on('minigameAction', ({ code, payload }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (!room || !room.currentCard || room.currentCard.type !== 'Mini Game Card' || room.minigameFinished) return;

    const handler = getMinigame(room.currentCard.minigameType);
    const { done } = handler.onAction(room, socket, payload || {}, io, code);
    if (done) {
      clearInterval(room.timerInterval);
      finishMinigame(code, io);
    }
  });

  socket.on('dareResult', ({ code, result }) => {
    code = code.toUpperCase();
    const room = rooms[code];
    if (!room || !room.currentCard || room.currentCard.type !== 'Dare Card') return;

    const p = room.currentCard.targetPlayer;
    if (!p) return;

    if (result === 'did_it') {
      try {
        const liveConfig = require('./config.json');
        if (liveConfig.features && liveConfig.features.spells) {
          const spellProbability = liveConfig.spellProbability !== undefined ? liveConfig.spellProbability : 0.3;
          if (Math.random() < spellProbability) {
            const randomSpell = spells[Math.floor(Math.random() * spells.length)];
            if (!p.spells) p.spells = [];
            p.spells.push(randomSpell);
            if (p.id) io.to(p.id).emit('spellGranted', randomSpell);
          }
        }
      } catch (e) { }
      drawNextCard(code, io);
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

      const drinks = room.currentCard.drinks;
      const beerEmojis = '🍺'.repeat(Math.min(drinks, 5)) + (drinks > 5 ? '...' : '');
      io.to(code).emit('cardResults', {
        stats: [],
        consequence: `<span style="color:${p.color || '#fff'}">${p.name}</span> bebeu ${beerEmojis} (${drinks})!`
      });
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
        if (p.spells) p.spells = p.spells.filter(s => s.id !== spellId);
        const msg = `✨ ${p.name} usou o feitiço ${spell.name} ${spell.icon}! \n${spell.description}`;
        io.to(code).emit('spellUsed', { player: p, spell, message: msg });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const mapping = socketMap[socket.id];
    delete socketMap[socket.id];
    if (!mapping) return;

    const { code } = mapping;
    const room = rooms[code];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.status === 'lobby') {
      // In lobby: remove the player entirely (no point holding a slot)
      room.players.splice(room.players.indexOf(player), 1);
      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        if (!room.players.find(p => p.isHost)) room.players[0].isHost = true;
        io.to(code).emit('playerLeft', room.players);
      }
    } else {
      // Mid-game: preserve the player slot so they can reconnect
      player.disconnected = true;
      player.id = null;
      io.to(code).emit('playerStatusUpdate', room.players);
      if (player.isHost) io.to(code).emit('hostDisconnected');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
