const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;

let games = {}; // gameId => {fen, players: [socket.id, socket.id], turn, moves, chess, playerNames}

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (gameId, playerName) => {
    console.log(`${socket.id} joining game ${gameId} as ${playerName}`);
    if (!games[gameId]) {
      games[gameId] = {
        fen: 'start',
        players: [],
        turn: 'w',
        moves: [],
        chess: new Chess(),
        playerNames: {},
      };
    }

    if (games[gameId].players.length < 2 && !games[gameId].players.includes(socket.id)) {
      games[gameId].players.push(socket.id);
      games[gameId].playerNames[socket.id] = playerName || `Player ${games[gameId].players.length}`;
      socket.join(gameId);
      const color = games[gameId].players.length === 1 ? 'w' : 'b';
      io.to(socket.id).emit('joinedGame', {
        gameId,
        fen: games[gameId].fen,
        moves: games[gameId].moves,
        color,
        turn: games[gameId].turn,
        playerIDs: games[gameId].players,
        playerNames: games[gameId].playerNames,
      });
      io.to(gameId).emit('playerUpdate', games[gameId].players.length);
      io.to(gameId).emit('playerNamesUpdate', games[gameId].playerNames);

      if (games[gameId].players.length === 2) {
        io.to(gameId).emit('startGame', { fen: games[gameId].fen });
      }
    } else {
      io.to(socket.id).emit('fullGame', 'Game is full');
    }
  });

  socket.on('makeMove', ({ gameId, move }) => {
    const game = games[gameId];
    if (!game) return;
    const playerIndex = game.players.indexOf(socket.id);
    const playerColor = playerIndex === 0 ? 'w' : 'b';
    if (playerColor !== game.turn) return; // Only allow move if it's this player's turn

    // Validate and make move
    const chess = game.chess;
    const result = chess.move(move);
    if (result) {
      game.fen = chess.fen();
      game.moves.push(move);
      game.turn = chess.turn();
      io.to(gameId).emit('moveMade', move, game.turn);
    }
  });

  socket.on('rematch', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    game.fen = 'start';
    game.moves = [];
    game.turn = 'w';
    game.chess = new Chess();
    io.to(gameId).emit('rematchStarted', {
      fen: game.fen,
      moves: game.moves,
      turn: game.turn,
      playerIDs: game.players,
      playerNames: game.playerNames,
    });
  });

  socket.on('resign', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    const playerIndex = game.players.indexOf(socket.id);
    const winner = playerIndex === 0 ? 1 : 0;
    io.to(gameId).emit('gameOver', { reason: 'resign', winner: game.players[winner], loser: socket.id });
  });

  socket.on('offerDraw', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    // Notify the other player
    const otherPlayer = game.players.find(id => id !== socket.id);
    if (otherPlayer) {
      io.to(otherPlayer).emit('drawOffered', { from: socket.id });
    }
  });

  socket.on('drawResponse', ({ gameId, accepted }) => {
    const game = games[gameId];
    if (!game) return;
    if (accepted) {
      io.to(gameId).emit('gameOver', { reason: 'draw' });
    } else {
      // Notify the offerer that the draw was declined
      io.to(gameId).emit('drawDeclined');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from games
    for (const gameId in games) {
      const players = games[gameId].players;
      const index = players.indexOf(socket.id);
      if (index !== -1) {
        players.splice(index, 1);
        delete games[gameId].playerNames[socket.id];
        io.to(gameId).emit('playerUpdate', players.length);
        io.to(gameId).emit('playerNamesUpdate', games[gameId].playerNames);
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