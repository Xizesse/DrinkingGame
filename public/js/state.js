export const socket = io();

export const chalkColors = [
  '#e6194b','#3cb44b','#ffe119','#4363d8','#f58231',
  '#911eb4','#42d4f4','#f032e6','#bfef45','#9a6324',
  '#469990','#ffffff'
];

export const iconList = ['🍺','🍷','🥃','🍸','🍹','🧉','🍶','🍾','🧊','🍻','🥂','🫧'];

// Generate a token if needed
let token = localStorage.getItem('chalkDrinkingGameToken');
if (!token) {
  token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  localStorage.setItem('chalkDrinkingGameToken', token);
}
export const state = {
  currentName: '',
  currentRoomCode: '',
  globalPlayers: [],
  globalCurrentCard: null,
  isLocalHost: false,
  mySpells: [],
  selectedSpellIndex: -1,
  currentBetAmount: 1,
  currentTugBet: 0,

  myMinigameData: null,
  minigameDataReceivedAt: 0,
  minigameState: {},
  myWordRevealed: false,
  myBetPlaced: false,

  myColor: chalkColors[Math.floor(Math.random() * chalkColors.length)],
  currentIconIndex: Math.floor(Math.random() * iconList.length),
  currentIcon: '',
  myToken: token
};
state.currentIcon = iconList[state.currentIconIndex];
