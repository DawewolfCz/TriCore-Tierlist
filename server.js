const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

app.get('/api/players', async (req, res) => {
    try {
        await client.connect();
        const database = client.db('tricore_tierlist');
        
        // Zkusíme najít data v kolekci 'players'
        let players = await database.collection('players').find({}).toArray();
        
        // Pokud tam nic není, zkusíme kolekci 'usernames'
        if (players.length === 0) {
            players = await database.collection('usernames').find({}).toArray();
        }
        
        res.json(players);
    } catch (error) {
        console.error("Chyba při čtení z databáze:", error);
        res.status(500).json({ error: "Chyba serveru při načítání dat" });
    }
});

app.use(express.static(path.join(__dirname)));

app.listen(port, () => {
    console.log(`Server běží na http://localhost:${port}`);
});