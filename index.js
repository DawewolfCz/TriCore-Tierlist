<!DOCTYPE html>
<html lang="cs">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TriCore Tierlist - Seznam hráčů</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #121212;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        h1 {
            color: #4CAF50;
        }
        .container {
            width: 100%;
            max-width: 600px;
            background: #1e1e1e;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            background: #2d2d2d;
            margin: 10px 0;
            padding: 12px 15px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 18px;
        }
        .loading {
            text-align: center;
            color: #888;
        }
    </style>
</head>
<body>

    <div class="container">
        <h1>TriCore Tierlist - Registrovaní hráči</h1>
        <p>Seznam hráčů propojených s Discordem:</p>
        
        <ul id="players-list">
            <li class="loading">Načítám hráče z databáze...</li>
        </ul>
    </div>

    <script>
        async function loadPlayers() {
            const listElement = document.getElementById('players-list');
            try {
                const response = await fetch('/api/players');
                if (!response.ok) {
                    throw new Error('Chyba serveru: ' + response.status);
                }
                
                const players = await response.json();
                listElement.innerHTML = ''; // Vymaže nápis o načítání

                // TADY PŘIDÁME TENTO ŘÁDEK PRO KONTROLU:
                console.puvodniData = players; 

                if (players.length === 0) {
                    listElement.innerHTML = '<li style="justify-content: center; color: #888;">Databáze vrátila prázdný seznam [].</li>';
                    return;
                }

                players.forEach(player => {
                    const li = document.createElement('li');
                    const nick = player.minecraftNick || player.nick || player.username || JSON.stringify(player);
                    li.innerHTML = `<span>🎮 <strong>${nick}</strong></span>`;
                    listElement.appendChild(li);
                });
            } catch (error) {
                console.error('Nepodařilo se načíst hráče:', error);
                listElement.innerHTML = `<li style="justify-content: center; color: #ff5252;">Chyba: ${error.message}</li>`;
            }
        }

        // Spustí načítání hned po načtení stránky
        loadPlayers();
    </script>

</body>
</html>