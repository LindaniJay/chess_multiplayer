import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import Chessboard from './Chessboard';

const socket = io('http://localhost:4000');

const App: React.FC = () => {
  const [gameId, setGameId] = useState('room1');
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState(0);
  const [fen, setFen] = useState('start');
  const [moves, setMoves] = useState<string[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinGame', gameId);
    });

    socket.on('joinedGame', ({ fen, moves }) => {
      setFen(fen === 'start' ? null : fen);
      setMoves(moves);
    });

    socket.on('playerUpdate', (count) => setPlayers(count));

    socket.on('moveMade', (move) => {
      setMoves((prev) => [...prev, move]);
    });

    socket.on('fullGame', (msg) => alert(msg));

    return () => {
      socket.off('connect');
      socket.off('joinedGame');
      socket.off('playerUpdate');
      socket.off('moveMade');
      socket.off('fullGame');
    };
  }, [gameId]);

  const sendMove = (move: string) => {
    socket.emit('makeMove', { gameId, move });
  };

  return (
    <div className="app-container">
      <h1>Multiplayer Chess</h1>
      <p>Game ID: {gameId}</p>
      <p>Players connected: {players}</p>
      <Chessboard
        fen={fen}
        moves={moves}
        onMove={(move) => sendMove(move)}
      />
    </div>
  );
};

export default App;