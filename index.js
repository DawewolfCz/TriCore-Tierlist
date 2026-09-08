require('dotenv').config();
const { Client, GatewayIntentBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb+srv://dawewolf4_db_user:4OYh2oOSSp54XBfu@dawewolfcz.zjd02ee.mongodb.net/tricore_tierlist";

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
            const mcNick = interaction.fields.getTextInputValue('nick_input');
            const targetMember = interaction.member;

            const isRestricted = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted');
            const isRetired = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'retired');

            const existingPlayer = await Player.findOne({ name: mcNick });
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

            try {
                await Player.findOneAndUpdate(
                    { name: mcNick },
                    {
                        name: mcNick,
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
            } catch (err) {
                console.error(err);
                await interaction.reply({ content: "Chyba při ukládání nicku do databáze.", ephemeral: true });
            }
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!syncplayer')) {
        const targetMember = message.mentions.members.first() || message.member;
        
        if (!targetMember) {
            return message.reply("Uživatel nenalezen.");
        }

        const isRestricted = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted');
        const isRetired = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'retired');

        const existingPlayer = await Player.findOne({ name: targetMember.user.username });
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

        try {
            await Player.findOneAndUpdate(
                { name: targetMember.user.username },
                {
                    name: targetMember.user.username,
                    region: "EU",
                    points: points,
                    title: title,
                    isRestricted: isRestricted,
                    isRetired: isRetired,
                    tiers: sampleTiers
                },
                { upsert: true, new: true }
            );

            message.reply(`Hráč **${targetMember.user.username}** byl úspěšně aktualizován! (Restricted: ${isRestricted}, Retired: ${isRetired}, Body: ${points})`);
        } catch (err) {
            console.error(err);
            message.reply("Chyba při ukládání hráče do databáze.");
        }
    }
});

client.login(process.env.DISCORD_TOKEN);