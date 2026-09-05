require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { MongoClient } = require('mongodb');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers 
    ] 
});

// Připojení k MongoDB Atlas
const mongoClient = new MongoClient(process.env.MONGODB_URI);
let db, usernamesCollection, playersCollection;

async function connectDB() {
    if (!db) {
        await mongoClient.connect();
        db = mongoClient.db('tricore_tierlist');
        usernamesCollection = db.collection('usernames');
        playersCollection = db.collection('players');
        console.log("Úspěšně připojeno k MongoDB Atlas!");
    }
}

const customKits = [
    'neth axe',
    'explosive diarrhea',
    'dia mace',
    'boat mace',
    'poorsmp',
    'netherite berry',
    'drainpvp',
    'lt mace'
];

const TIER_POINTS = {
    "ht1": 60, "lt1": 48,
    "ht2": 32, "lt2": 24,
    "ht3": 16, "lt3": 10,
    "ht4": 5, "lt4": 3,
    "ht5": 2, "lt5": 1
};

function calculatePlayerPoints(playerTiers) {
    let totalPoints = 0;
    if (!playerTiers) return totalPoints;
    for (let kit in playerTiers) {
        let tier = playerTiers[kit];
        if (tier) {
            let tierLower = tier.trim().toLowerCase();
            if (TIER_POINTS[tierLower]) {
                totalPoints += TIER_POINTS[tierLower];
            }
        }
    }
    return totalPoints;
}

// Bezpečná funkce pro synchronizaci (využívá cache, nezpůsobuje rate limit)
async function syncAndSavePlayers(guild) {
    try {
        await connectDB();
        let playersList = [];

        const allUsernamesCursor = usernamesCollection.find({});
        const allUsernames = await allUsernamesCursor.toArray();
        const linkedUsernames = {};
        allUsernames.forEach(item => {
            linkedUsernames[item.discordId] = item.mcNick;
        });

        guild.members.cache.forEach(member => {
            if (member.user.bot) return;

            const mcUsername = linkedUsernames[member.id] || member.user.username;
            let userTiers = {};
            let hasAnyTier = false;

            customKits.forEach(kit => {
                const matchedRole = member.roles.cache.find(r => {
                    const rName = r.name.toLowerCase();
                    return rName.startsWith(kit.toLowerCase());
                });

                if (matchedRole) {
                    hasAnyTier = true;
                    const parts = matchedRole.name.toLowerCase().split('-');
                    if (parts.length > 1) {
                        userTiers[kit] = parts[1].trim();
                    } else {
                        userTiers[kit] = 'ht1';
                    }
                } else {
                    userTiers[kit] = '-';
                }
            });

            if (hasAnyTier) {
                const calculatedPoints = calculatePlayerPoints(userTiers);

                playersList.push({
                    name: mcUsername,
                    title: "Combat Member",
                    points: calculatedPoints,
                    region: "Europe",
                    regionClass: "region-eu",
                    tiers: userTiers
                });
            }
        });

        playersList.sort((a, b) => b.points - a.points);

        await playersCollection.deleteMany({});
        if (playersList.length > 0) {
            await playersCollection.insertMany(playersList);
        }
        console.log("Data hráčů byla úspěšně synchronizována do MongoDB!");
    } catch (err) {
        console.error("Chyba při synchronizaci hráčů:", err);
    }
}

client.once('ready', async () => {
    await connectDB();
    console.log(`Bot je přihlášen jako ${client.user.tag}!`);

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
        await guild.channels.fetch();

        let channel = guild.channels.cache.find(c => c.name === 'minecraft-nicky' && c.isTextBased());
        
        if (!channel) {
            channel = await guild.channels.create({
                name: 'minecraft-nicky',
                topic: 'Zde si můžeš zadat svůj oficiální Minecraft nick pro tierlist.'
            });
            console.log("Kanál #minecraft-nicky byl úspěšně vytvořen!");
        }

        const messages = await channel.messages.fetch({ limit: 5 });
        const hasBotMessage = messages.some(m => m.author.id === client.user.id);

        if (!hasBotMessage) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('open_nick_modal')
                    .setLabel('Zadat Minecraft Nick')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );

            await channel.send({
                content: '**TriCore Tierlist - Registrace nicku**\nKlikni na tlačítko níže a zadej svůj herní Minecraft nick, aby se ti správně zobrazil na webu!',
                components: [row]
            });
        }

        await syncAndSavePlayers(guild);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton() && interaction.customId === 'open_nick_modal') {
        const modal = new ModalBuilder()
            .setCustomId('minecraft_nick_modal')
            .setTitle('Nastavení Minecraft Nicku');

        const nickInput = new TextInputBuilder()
            .setCustomId('mc_nick_input')
            .setLabel('Tvůj přesný Minecraft Nick')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('např. Notch')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(nickInput));
        await interaction.showModal(modal);
    } 
    else if (interaction.isModalSubmit() && interaction.customId === 'minecraft_nick_modal') {
        await interaction.deferReply({ ephemeral: true });

        try {
            await connectDB(); // Ensure database and collections are initialized

            const enteredNick = interaction.fields.getTextInputValue('mc_nick_input').trim();
            const userId = interaction.user.id;

            await usernamesCollection.updateOne(
                { discordId: userId },
                { $set: { mcNick: enteredNick } },
                { upsert: true }
            );

            await syncAndSavePlayers(interaction.guild);

            await interaction.editReply({
                content: `✅ Tvůj Minecraft nick byl úspěšně nastaven na: **${enteredNick}**! Databáze byla aktualizována.`
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: `❌ Nastala chyba při ukládání nicku: ${error.message}`
            });
        }
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (newMember.guild.id === process.env.GUILD_ID) {
        await syncAndSavePlayers(newMember.guild);
    }
});

client.login(process.env.DISCORD_TOKEN);