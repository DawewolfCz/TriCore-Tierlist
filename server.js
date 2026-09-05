const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Připojovací řetězec z MongoDB Atlas uložený v .env
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Endpoint, který web zavolá, aby získal seznam hráčů
app.get('/api/players', async (req, res) => {
    try {
        await client.connect();
        const database = client.db('tricore_tierlist'); // Název vaší databáze
        const collection = database.collection('users'); // Název vaší kolekce (zkontrolujte, kam bot ukládá data)
        
        // Získá všechny hráče z databáze
        const players = await collection.find({}).toArray();
        res.json(players);
    } catch (error) {
        console.error("Chyba při čtení z databáze:", error);
        res.status(500).json({ error: "Chyba serveru při načítání dat" });
    }
});

// Automaticky servíruje soubory (index.html atd.) ze stejné složky
app.use(express.static(path.join(__dirname)));

app.listen(port, () => {
    console.log(`Server běží na http://localhost:${port}`);
});