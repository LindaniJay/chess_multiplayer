import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';


interface Props {
  fen: string | null;
  moves: string[];
  onMove: (move: string) => void;
}

const Chessboard: React.FC<Props> = ({ fen, moves, onMove }) => {
  const [game, setGame] = useState(new Chess());

  // Initialize game from fen or reset
  useEffect(() => {
    const newGame = new Chess();
    if (fen) {
      newGame.load(fen);
    }
    setGame(newGame);
  }, [fen]);

  // Apply moves from server
  useEffect(() => {
    const newGame = new Chess(game.fen());
    moves.forEach((move) => {
      newGame.move(move);
    });
    setGame(newGame);
  }, [moves]);

  const onSquareClick = (from: string, to: string) => {
    const move = game.move({ from, to, promotion: 'q' });
    if (move) {
      onMove(move.san);
      setGame(new Chess(game.fen()));
    }
  };

  return (
    <div>
      {/* Here would be your full Chessboard UI */}
      <div>Chessboard placeholder - integrate your UI here</div>
      <button onClick={() => onSquareClick('e2', 'e4')}>Move e2 to e4</button>
    </div>
  );
};

export default Chessboard;