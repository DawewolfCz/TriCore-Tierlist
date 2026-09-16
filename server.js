require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const app = express();
const port = process.env.PORT || 10000;

// ==========================================
// 1. MONGODB PŘIPOJENÍ
// ==========================================
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log("Úspěšně připojeno k MongoDB!"))
    .catch(err => console.error("Chyba při připojování k MongoDB:", err));

const playerSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    region: { type: String, default: "EU" },
    points: { type: Number, default: 0 },
    title: { type: String, default: "Combat Member" },
    isRestricted: { type: Boolean, default: false },
    isRetired: { type: Boolean, default: false },
    tiers: { type: Object, default: {} }
}, { strict: false });

const Player = mongoose.model('Player', playerSchema, 'players');

// ==========================================
// 2. EXPRESS WEB SERVER (API pro web)
// ==========================================
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find({});
        console.log("Found players in DB:", players.length);
        res.json(players);
    } catch (err) {
        console.error("DB Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Web Server is running on port ${port}`);
});

// ==========================================
// 3. DISCORD BOT LOGIKA
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function calculatePoints(tiersObj) {
    let totalPoints = 0;
    const tierValues = {
        "ht1": 100, "lt1": 80,
        "ht2": 65,  "lt2": 50,
        "ht3": 35,  "lt3": 25,
        "ht4": 15,  "lt4": 10,
        "ht5": 5,   "lt5": 2
    };

    for (const kit in tiersObj) {
        const val = tiersObj[kit] ? tiersObj[kit].toLowerCase().trim() : "";
        if (tierValues[val]) {
            totalPoints += tierValues[val];
        }
    }
    return totalPoints;
}

function getTitleByPoints(points) {
    if (points >= 500) return "Combat Legend";
    if (points >= 300) return "Combat Master";
    if (points >= 150) return "Combat Veteran";
    if (points >= 50) return "Combat Warrior";
    return "Combat Member";
}

client.on('ready', () => {
    console.log(`Discord bot je přihlášen jako ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!setup') {
        const button = new ButtonBuilder()
            .setCustomId('set_minecraft_nick')
            .setLabel('Zaregistrovat nick')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(button);

        await message.channel.send({
            content: 'Kliknutím na tlačítko níže si můžeš zaregistrovat nebo aktualizovat svůj Minecraft nick:',
            components: [row]
        });
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === 'set_minecraft_nick') {
                const modal = new ModalBuilder()
                    .setCustomId('minecraft_nick_modal')
                    .setTitle('Registrace Minecraft Nicku');

                const nickInput = new TextInputBuilder()
                    .setCustomId('nick_input')
                    .setLabel('Tvůj Minecraft nick')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Zde napiš svůj nick...')
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(nickInput);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'minecraft_nick_modal') {
                const mcNick = interaction.fields.getTextInputValue('nick_input').trim();
                const targetMember = interaction.member;

                const isRestricted = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted');
                const isRetired = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'retired');

                const existingPlayer = await Player.findOne({ name: { $regex: new RegExp(`^${mcNick}$`, 'i') } });
                
                const sampleTiers = existingPlayer && existingPlayer.tiers ? existingPlayer.tiers : {
                    "neth axe": "-",
                    "explosive diarrhea": "-",
                    "dia mace": "-",
                    "altarsmp": "-",
                    "poorsmp": "-",
                    "netherite berry": "-",
                    "drainpvp": "-",
                    "lt mace": "-"
                };

                const points = calculatePoints(sampleTiers);
                const title = getTitleByPoints(points);

                await Player.findOneAndUpdate(
                    { name: existingPlayer ? existingPlayer.name : mcNick },
                    {
                        name: existingPlayer ? existingPlayer.name : mcNick,
                        region: "EU",
                        points: points,
                        title: title,
                        isRestricted: isRestricted,
                        isRetired: isRetired,
                        tiers: sampleTiers
                    },
                    { upsert: true, new: true }
                );

                await interaction.reply({ 
                    content: `Úspěšně zaregistrován Minecraft nick **${mcNick}**! (Body: ${points}, Restricted: ${isRestricted})`, 
                    ephemeral: true 
                });
            }
        }
    } catch (err) {
        console.error("Chyba při zpracování interakce:", err);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "Chyba při zpracování požadavku.", ephemeral: true }).catch(() => {});
        }
    }
});

// PŘIHLAŠOVACÍ TOKEN DISCORD BOTA
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN);
} else {
    console.warn("⚠️ VAROVÁNÍ: Chybí DISCORD_TOKEN v Environment Variables!");
}
