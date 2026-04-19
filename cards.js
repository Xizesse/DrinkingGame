class DrinkCard {
    constructor(text, drinks = 1) {
        this.text = text;
        this.drinks = drinks;
        this.type = "Drink Card";
    }
}

class VotingCard {
    constructor(text, time = 15, consequences = null) {
        this.text = text;
        this.time = time;
        this.type = "Voting Card";

        this.consequences = consequences || [
            "Quem errou bebe",
            "Quem acertou bebe",
            "O mais votado bebe",
            "O menos votado bebe"
        ];
    }
}

class EventCard {
    constructor(text, subtext = "", time = 5, interactive = false) {
        this.text = text;
        this.subtext = subtext;
        this.time = time;
        this.interactive = interactive; // false, 'press', 'dont_press'
        this.type = "Event Card";
    }
}

class DareCard {
    constructor(text, drinksIfFail) {
        this.text = text;
        this.drinks = drinksIfFail;
        this.type = "Dare Card";
    }
}

const cardDatabase = [
    // Drink Cards
    new DrinkCard('Quem já vomitou na casa de outra pessoa', 1),
    new DrinkCard('Quem já vomitou em roupa', 1),
    new DrinkCard('Quem já foi apanhado pelos pais', 1),
    new DrinkCard('Quem já apanhou os pais', 1),

    // Voting Cards
    new VotingCard('Quem é o mais velho?', 15, ["Quem falhou tira um penalty", "O mais velho bebe 🍺🍺"]),
    new VotingCard('Quem é o mais novo?', 15, ["A maioria dita a lei: o mais votado bebe 🍺🍺", "Quem não votou no mais novo bebe 🍺"]),
    new VotingCard('Quem foi o ultimo a usar a casa de banho?', 15, ["Bebem todos os que erraram 🍺", "O culpado distribui 3 🍺🍺🍺"]),
    new VotingCard('Quem está mais bêbado?', 15, ["O mais votado bebe 🍺🍺", "O mais votado escolhe a sua próxima vítima para beber 🍺"]),

    // Event Cards
    new EventCard('Jogo do sério!', 'Quem se rir bebe', 10, false),
    new EventCard('O chão é lava!', 'O ultimo a tirar os pés do chão bebe', 5, false),
    new EventCard('CARREGA NO BOTÃO!', '', 5, 'press'),
    new EventCard('não toques no botão...', '', 5, 'dont_press'),

    // Dare Cards
    new DareCard('{player} tem de cantar o Let it Go do Frozen ou bebe {drinks}', 3),
    new DareCard('{player} tem de deixar os outros lerem a sua última mensagem recebida ou bebe {drinks}', 2)
];

const config = require('./config.json');

function getRandomCard() {
    const probs = config.cardProbabilities;
    const r = Math.random();
    let cumulative = 0;

    // Default to the first valid feature turned on
    const validFeatures = Object.keys(probs).filter(t => config.features && config.features[t]);
    let selectedType = validFeatures.length > 0 ? validFeatures[0] : "Drink Card";

    // Normalize probabilities among active features
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

module.exports = { DrinkCard, VotingCard, EventCard, DareCard, getRandomCard };
