const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

const port = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const playerSchema = new mongoose.Schema({
    name: String,
    points: Number,
    region: String,
    status: String,
    tiers: Object
});
const Player = mongoose.model('Player', playerSchema);

app.get('/api/players', async (req, res) => {
    try {
        const players = await Player.find({});
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch players" });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});