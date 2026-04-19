const fs = require('fs');
const path = require('path');
const config = require('./config.json');

class DrinkCard {
    constructor(data = {}) {
        this.text = data.text || "";
        this.drinks = data.drinks || 1;
        this.type = "Drink Card";
    }
}

class VotingCard {
    constructor(data = {}) {
        this.text = data.text || "";
        this.time = data.time || 15;
        this.drinks = data.drinks || 1;
        this.type = "Voting Card";
        this.consequences = data.consequences || [
            "Quem errou bebe",
            "Quem acertou bebe",
            "O mais votado bebe",
            "O menos votado bebe"
        ];
    }
}

class EventCard {
    constructor(data = {}) {
        this.text = data.text || "";
        this.subtext = data.subtext || "";
        this.time = data.time || 5;
        this.drinks = data.drinks || 1;
        this.interactive = data.interactive || false; // false, 'press', 'dont_press'
        this.type = "Event Card";
    }
}

class DareCard {
    constructor(data = {}) {
        this.text = data.text || "";
        this.drinks = data.drinks || 1;
        this.type = "Dare Card";
    }
}

let cardDatabase = [];

function loadCards() {
    const categories = [
        { file: 'drink_cards.json', class: DrinkCard },
        { file: 'voting_cards.json', class: VotingCard },
        { file: 'event_cards.json', class: EventCard },
        { file: 'dare_cards.json', class: DareCard }
    ];

    cardDatabase = [];
    categories.forEach(cat => {
        const filePath = path.join(__dirname, 'cards', cat.file);
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                data.forEach(item => {
                    cardDatabase.push(new cat.class(item));
                });
            } catch (err) {
                console.error(`Error loading ${cat.file}:`, err);
            }
        }
    });
    console.log(`Loaded ${cardDatabase.length} cards from database.`);
}

// Initial load
loadCards();

function getRandomCard() {
    const probs = config.cardProbabilities;
    const r = Math.random();
    let cumulative = 0;

    const validFeatures = Object.keys(probs).filter(t => config.features && config.features[t]);
    let selectedType = validFeatures.length > 0 ? validFeatures[0] : "Drink Card";

    let totalProb = validFeatures.reduce((sum, t) => sum + probs[t], 0);
    if (totalProb === 0) totalProb = 1;

    for (const type of validFeatures) {
        cumulative += probs[type] / totalProb;
        if (r <= cumulative) {
            selectedType = type;
            break;
        }
    }

    let pool = cardDatabase.filter(c => c.type === selectedType);
    if (pool.length === 0) pool = cardDatabase;

    const index = Math.floor(Math.random() * pool.length);
    const originalCard = pool[index];
    const card = { ...originalCard };

    if (card.type === "Voting Card" && originalCard.consequences) {
        const rad = Math.floor(Math.random() * originalCard.consequences.length);
        card.consequence = originalCard.consequences[rad];
    }
    return card;
}

module.exports = { DrinkCard, VotingCard, EventCard, DareCard, getRandomCard, loadCards };
