require('dotenv').config();
const express = require('express');
const path = require('path');
const { 
    Client, 
    GatewayIntentBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const mongoose = require('mongoose');

// --- 1. EXPRESS SERVER ---
const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// --- 2. MONGOOSE SCHEMA & MODEL ---
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
});

const Player = mongoose.model('Player', playerSchema, 'players');

// Defaultní struktura kitů
const DEFAULT_TIERS = {
    "neth axe": "-",
    "explosive diarrhea": "-",
    "dia mace": "-",
    "altarsmp": "-",
    "poorsmp": "-",
    "netherite berry": "-",
    "drainpvp": "-",
    "lt mace": "-"
};

// --- 3. API ENDPOINT PRO WEB ---
app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find({});
        res.json(players);
    } catch (error) {
        console.error("Chyba při načítání hráčů pro web:", error);
        res.status(500).json({ error: "Chyba při načítání dat" });
    }
});

// --- 4. HELPER FUNKCE PRO BODY A TITULY ---
function calculatePoints(tiersObj) {
    let totalPoints = 0;
    const tierValues = {
        "ht1": 100, "lt1": 80,
        "ht2": 65,  "lt2": 50,
        "ht3": 35,  "lt3": 25,
        "ht4": 15,  "lt4": 10,
        "ht5": 5,   "lt5": 2
    };

    if (!tiersObj) return 0;

    for (const kit in tiersObj) {
        const val = tiersObj[kit] ? tiersObj[kit].toString().toLowerCase().trim() : "";
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

// --- 5. DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', () => {
    console.log(`Discord bot je přihlášen jako ${client.user.tag}!`);
});

// Zpracování zpráv/příkazů
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Příkaz !setup pro vytvoření tlačítka
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

    // Příkaz na ruční nastavení tieru: !settier <Nick> <Kit> <Tier>
    // Příklad: !settier NickName "neth axe" ht1
    if (message.content.startsWith('!settier')) {
        const args = message.content.slice(8).trim().match(/(?:[^\s"]+|"[^"]*")+/g);
        
        if (!args || args.length < 3) {
            return message.reply('Použití: `!settier <Nick> "<Kit>" <Tier>`\nPříklad: `!settier Player1 "neth axe" ht1`');
        }

        const nick = args[0].replace(/"/g, '').trim();
        const kit = args[1].replace(/"/g, '').toLowerCase().trim();
        const tier = args[2].replace(/"/g, '').toLowerCase().trim();

        try {
            let player = await Player.findOne({ name: { $regex: new RegExp(`^${nick}$`, 'i') } });

            if (!player) {
                player = new Player({
                    name: nick,
                    region: "EU",
                    tiers: { ...DEFAULT_TIERS }
                });
            }

            // Vytvoříme kopii objektu
            const updatedTiers = { ...player.tiers };
            updatedTiers[kit] = tier;

            player.tiers = updatedTiers;
            player.markModified('tiers');

            player.points = calculatePoints(player.tiers);
            player.title = getTitleByPoints(player.points);

            await player.save();

            message.reply(`Úspěšně nastaven **${kit}** na **${tier}** pro **${player.name}**. Body: **${player.points}** (${player.title})`);
        } catch (err) {
            console.error(err);
            message.reply('Chyba při ukládání do databáze.');
        }
    }
});

// Zpracování tlačítka a modalu
client.on('interactionCreate', async interaction => {
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

            const isRestricted = targetMember ? targetMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted') : false;
            const isRetired = targetMember ? targetMember.roles.cache.some(role => role.name.toLowerCase() === 'retired') : false;

            try {
                let player = await Player.findOne({ name: { $regex: new RegExp(`^${mcNick}$`, 'i') } });

                if (!player) {
                    player = new Player({
                        name: mcNick,
                        region: "EU",
                        tiers: { ...DEFAULT_TIERS }
                    });
                }

                player.isRestricted = isRestricted;
                player.isRetired = isRetired;

                player.points = calculatePoints(player.tiers);
                player.title = getTitleByPoints(player.points);

                player.markModified('tiers');
                await player.save();

                await interaction.reply({ 
                    content: `Úspěšně synchronizován nick **${player.name}**! (Body: ${player.points}, Title: ${player.title})`, 
                    ephemeral: true 
                });

            } catch (err) {
                console.error("Chyba při ukládání z Discordu:", err);
                await interaction.reply({ content: "Chyba při ukládání nicku do databáze.", ephemeral: true });
            }
        }
    }
});

// --- 6. SPUŠTĚNÍ APPky ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
    client.login(process.env.DISCORD_TOKEN);
});
