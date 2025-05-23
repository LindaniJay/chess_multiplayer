const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;

let games = {}; // gameId => {fen, players: [socket.id, socket.id], turn}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (gameId) => {
    console.log(`${socket.id} joining game ${gameId}`);
    if (!games[gameId]) {
      games[gameId] = {
        fen: 'start',
        players: [],
        turn: 'w',
        moves: []
      };
    }

    if (games[gameId].players.length < 2 && !games[gameId].players.includes(socket.id)) {
      games[gameId].players.push(socket.id);
      socket.join(gameId);
      io.to(socket.id).emit('joinedGame', { gameId, fen: games[gameId].fen, moves: games[gameId].moves });
      io.to(gameId).emit('playerUpdate', games[gameId].players.length);

      if (games[gameId].players.length === 2) {
        io.to(gameId).emit('startGame', { fen: games[gameId].fen });
      }
    } else {
      io.to(socket.id).emit('fullGame', 'Game is full');
    }
  });

  socket.on('makeMove', ({ gameId, move }) => {
    if (!games[gameId]) return;

    // Broadcast move to all players in room
    games[gameId].moves.push(move);
    io.to(gameId).emit('moveMade', move);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from games
    for (const gameId in games) {
      const players = games[gameId].players;
      const index = players.indexOf(socket.id);
      if (index !== -1) {
        players.splice(index, 1);
        io.to(gameId).emit('playerUpdate', players.length);
        if (players.length === 0) {
          delete games[gameId];
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});