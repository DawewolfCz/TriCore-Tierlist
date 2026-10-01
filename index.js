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
    discordId: { type: String, default: null }, // Přidáno pro automatickou aktualizaci podle ID
    region: { type: String, default: "EU" },
    points: { type: Number, default: 0 },
    title: { type: String, default: "Combat Member" },
    isRestricted: { type: Boolean, default: false },
    isRetired: { type: Boolean, default: false },
    tiers: { type: Object, default: {} }
});

const Player = mongoose.model('Player', playerSchema, 'players');

// Seznam sledovaných kitů na webu
const KITS = [
    "neth axe",
    "explosive diarrhea",
    "dia mace",
    "altarsmp",
    "poorsmp",
    "netherite berry",
    "drainpvp",
    "lt mace"
];

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

// --- 4. POMOCNÉ FUNKCE ---

// Výpočet bodů
function calculatePoints(tiersObj) {
    let totalPoints = 0;
    const tierValues = {
        "ht1": 60, "lt1": 48,
        "ht2": 32, "lt2": 24,
        "ht3": 16, "lt3": 10,
        "ht4": 5,  "lt4": 3,
        "ht5": 2,  "lt5": 1
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
    if (points >= 350) return "Combat Legend";
    if (points >= 200) return "Combat Master";
    if (points >= 100) return "Combat Veteran";
    if (points >= 50) return "Combat Warrior";
    return "Combat Member";
}

// Vytažení tierů z rolí uživatele
function getTiersFromRoles(member) {
    const detectedTiers = {
        "neth axe": "-",
        "explosive diarrhea": "-",
        "dia mace": "-",
        "altarsmp": "-",
        "poorsmp": "-",
        "netherite berry": "-",
        "drainpvp": "-",
        "lt mace": "-"
    };

    if (!member || !member.roles) return detectedTiers;

    const validTiers = ["ht1", "lt1", "ht2", "lt2", "ht3", "lt3", "ht4", "lt4", "ht5", "lt5"];

    member.roles.cache.forEach(role => {
        const roleName = role.name.toLowerCase().trim();

        // Podpora pro formát: "altarsmp-lt3"
        if (roleName.includes('-')) {
            const parts = roleName.split('-');
            const kitName = parts[0].trim();
            const tierValue = parts[1].trim();

            if (detectedTiers.hasOwnProperty(kitName)) {
                detectedTiers[kitName] = tierValue.toUpperCase();
            }
        } else {
            // Podpora pro formát: "Neth Axe HT1" nebo "Altarsmp LT2"
            KITS.forEach(kit => {
                if (roleName.includes(kit)) {
                    const foundTier = validTiers.find(t => roleName.includes(t));
                    if (foundTier) {
                        detectedTiers[kit] = foundTier.toUpperCase();
                    }
                }
            });
        }
    });

    return detectedTiers;
}

// --- 5. DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Zásadní pro sledování rolí
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

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
            content: 'Kliknutím na tlačítko níže si zaregistruješ svůj Minecraft nick a načtou se ti role z Discordu na web:',
            components: [row]
        });
    }
});

// Zpracování tlačítka a modalu (Registrace)
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

            const tiersFromRoles = getTiersFromRoles(targetMember);

            try {
                let player = await Player.findOne({ name: { $regex: new RegExp(`^${mcNick}$`, 'i') } });

                if (!player) {
                    player = new Player({ name: mcNick });
                }

                // Uložíme ID z Discordu pro budoucí automatické aktualizace
                player.discordId = targetMember.id;
                player.region = "EU";
                player.isRestricted = isRestricted;
                player.isRetired = isRetired;
                player.tiers = tiersFromRoles;

                player.points = calculatePoints(player.tiers);
                player.title = getTitleByPoints(player.points);

                player.markModified('tiers');
                await player.save();

                await interaction.reply({ 
                    content: `Úspěšně synchronizováno! Propojeno s Discord účtem. Načteny role pro nick **${player.name}**. Body: **${player.points}** (${player.title}).`, 
                    ephemeral: true 
                });

            } catch (err) {
                console.error("Chyba při ukládání z Discordu:", err);
                await interaction.reply({ content: "Chyba při ukládání nicku do databáze.", ephemeral: true });
            }
        }
    }
});

// --- 6. AUTOMATICKÁ AKTUALIZACE PŘI ZMĚNĚ ROLÍ ---
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        // Vyhledáme hráče v databázi podle jeho Discord ID
        const player = await Player.findOne({ discordId: newMember.id });
        
        // Pokud hráč ještě není v databázi (nezaregistroval si nick přes !setup), přeskočíme ho
        if (!player) return;

        // Načteme nové tiery z jeho aktuálních rolí
        const updatedTiers = getTiersFromRoles(newMember);
        const isRestricted = newMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted');
        const isRetired = newMember.roles.cache.some(role => role.name.toLowerCase() === 'retired');

        // Uložíme nové hodnoty
        player.tiers = updatedTiers;
        player.isRestricted = isRestricted;
        player.isRetired = isRetired;
        player.points = calculatePoints(player.tiers);
        player.title = getTitleByPoints(player.points);

        player.markModified('tiers');
        await player.save();

        console.log(`[Auto-Update] Hráči ${player.name} byly automaticky aktualizovány tiery podle nově přidělených rolí!`);
    } catch (error) {
        console.error("Chyba při automatické aktualizaci rolí:", error);
    }
});

// --- 7. SPUŠTĚNÍ ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server běží na portu ${PORT}`);
    client.login(process.env.DISCORD_TOKEN);
});
