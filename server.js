const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const port = process.env.PORT || 10000;


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.use(express.json());

app.use(express.static(path.join(__dirname)));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const playerSchema = new mongoose.Schema({
    name: String,
    points: Number,
    region: String,
    title: String,
    status: String,
    isRestricted: Boolean,
    isRetired: Boolean,
    tiers: Object
}, { strict: false });

const Player = mongoose.model('Player', playerSchema, 'players');


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


app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
