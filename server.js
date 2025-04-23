const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Almacenar información de los jugadores
const players = new Map();

// Configuración de armas
const weapons = {
    pistol: {
        damage: 10,
        speed: 0.5
    },
    shotgun: {
        damage: 15,
        speed: 0.3
    },
    rifle: {
        damage: 20,
        speed: 0.7
    }
};

io.on('connection', (socket) => {
    console.log('Un jugador se ha conectado:', socket.id);
    
    // Inicializar jugador
    players.set(socket.id, {
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        health: 100,
        weapon: 'pistol' // Arma por defecto
    });
    
    // Enviar información de todos los jugadores al nuevo jugador
    socket.emit('currentPlayers', Array.from(players.entries()));
    
    // Notificar a otros jugadores sobre el nuevo jugador
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        health: 100,
        weapon: 'pistol'
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        players.delete(socket.id);
        io.emit('playerDisconnected', socket.id);
    });

    socket.on('playerMove', (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = data.position;
            player.rotation = data.rotation;
            socket.broadcast.emit('updatePlayer', {
                id: socket.id,
                position: data.position,
                rotation: data.rotation
            });
        }
    });
    
    socket.on('playerShoot', (data) => {
        // Enviar información del disparo a todos los jugadores
        io.emit('bulletFired', {
            playerId: socket.id,
            position: data.position,
            direction: data.direction,
            weaponType: data.weaponType
        });
    });
    
    socket.on('playerHit', (data) => {
        const targetPlayer = players.get(data.targetId);
        if (targetPlayer) {
            const weaponConfig = weapons[data.weaponType] || weapons.pistol;
            targetPlayer.health -= weaponConfig.damage;
            if (targetPlayer.health <= 0) {
                // Respawn del jugador
                targetPlayer.health = 100;
                targetPlayer.position = { x: 0, y: 0, z: 0 };
                io.emit('playerRespawn', {
                    id: data.targetId,
                    position: targetPlayer.position,
                    health: targetPlayer.health
                });
            } else {
                io.emit('playerDamaged', {
                    id: data.targetId,
                    health: targetPlayer.health
                });
            }
        }
    });
});

// Escuchar en el puerto 3000
server.listen(3000, () => {
    console.log('Servidor corriendo en http://localhost:3000');
});
