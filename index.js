require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || "mongodb+srv://dawewolf4_db_user:4OYh2oOSSp54XBfu@dawewolfcz.zjd02ee.mongodb.net";

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
    tiers: {
        type: Map,
        of: String,
        default: {}
    }
});

const Player = mongoose.model('Player', playerSchema);

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

    if (message.content.startsWith('!syncplayer')) {
        const targetMember = message.mentions.members.first() || message.member;
        
        if (!targetMember) {
            return message.reply("Uživatel nenalezen.");
        }

        const isRestricted = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'restricted');
        const isRetired = targetMember.roles.cache.some(role => role.name.toLowerCase() === 'retired');

        const sampleTiers = {
            "neth axe": "ht1",
            "explosive diarrhea": "lt3",
            "dia mace": "-",
            "altarsmp": "ht2",
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