import React, { useState, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './Chessboard.css';
import io from 'socket.io-client';

interface Props {
  fen: string | null;
  moves: string[];
  onMove: (move: string) => void;
  playerColor: 'w' | 'b' | null;
  turn: 'w' | 'b';
  soloMode?: boolean;
  boardOrientation?: 'white' | 'black';
  boardTheme?: 'manly' | 'classic' | 'blue' | 'green' | 'wood';
  aiMode?: boolean;
  onUndoAiMove?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRedoAiMove?: () => void;
  canRedo?: boolean;
  canRedoAi?: boolean;
}

const themeColors = {
  manly: { light: '#BCAAA4', dark: '#3E2723' },
  classic: { light: '#f0d9b5', dark: '#b58863' },
  blue: { light: '#e0eaff', dark: '#3a5ca8' },
  green: { light: '#eaffea', dark: '#3a8a3a' },
  wood: { light: '#ecdab9', dark: '#b88762' },
};

const ChessboardComponent: React.FC<Props> = ({ fen, moves, onMove, playerColor, turn, soloMode, boardOrientation, boardTheme = 'manly', aiMode, onUndoAiMove, onUndo, onRedo, onRedoAiMove, canRedo, canRedoAi }) => {
  const [game, setGame] = useState(new Chess());
  const [lastMoveSquares, setLastMoveSquares] = useState<{from: string, to: string} | null>(null);
  const [boardWidth, setBoardWidth] = useState<number>(Math.min(window.innerWidth * 0.9, 350));
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [prevFen, setPrevFen] = useState<string>('start');
  const [mpMessage, setMpMessage] = useState<string | null>(null);
  const [drawOffer, setDrawOffer] = useState<{ from: string } | null>(null);
  const [gameOver, setGameOver] = useState<string | null>(null);
  const [hintSquares, setHintSquares] = useState<string[]>([]);

  const socket = io('http://localhost:4000');

  useEffect(() => {
    const handleResize = () => {
      setBoardWidth(Math.min(window.innerWidth * 0.9, 350));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize game from fen or reset
  useEffect(() => {
    const newGame = new Chess();
    if (fen && fen !== 'start') {
      newGame.load(fen);
    }
    setGame(newGame);
  }, [fen]);

  // Apply moves from server
  useEffect(() => {
    const newGame = new Chess(game.fen());
    let lastMove: any = null;
    moves.forEach((move) => {
      try {
        lastMove = newGame.move(move);
      } catch (err) {
        console.warn('Invalid move in history:', move, err);
      }
    });
    setGame(newGame);
    if (lastMove && lastMove.from && lastMove.to) {
      setLastMoveSquares({ from: lastMove.from, to: lastMove.to });
    }
  }, [moves]);

  useEffect(() => {
    socket.off('drawOffered');
    socket.off('drawDeclined');
    socket.off('gameOver');
    socket.on('drawOffered', (data) => {
      setDrawOffer(data);
      setMpMessage('Opponent offered a draw.');
    });
    socket.on('drawDeclined', () => {
      setMpMessage('Opponent declined your draw offer.');
      setDrawOffer(null);
    });
    socket.on('gameOver', (data) => {
      if (data.reason === 'resign') {
        setGameOver(data.loser === socket.id ? 'You resigned. Game over.' : 'Opponent resigned. You win!');
      } else if (data.reason === 'draw') {
        setGameOver('Game drawn by agreement.');
      }
      setDrawOffer(null);
    });
    return () => {
      socket.off('drawOffered');
      socket.off('drawDeclined');
      socket.off('gameOver');
    };
  }, []);

  const handlePieceDrop = (sourceSquare: string, targetSquare: string) => {
    let debug = '';
    // In solo mode, allow both sides to move
    if (!soloMode && (!playerColor || playerColor !== turn)) {
      setMoveError("It's not your turn.");
      setGame(new Chess(prevFen));
      return false;
    }
    const moveObj = { from: sourceSquare, to: targetSquare, promotion: 'q' };
    const legalMoves = game.moves({ verbose: true });
    const isLegal = legalMoves.some(m => m.from === sourceSquare && m.to === targetSquare);
    setPrevFen(game.fen());
    let move = null;
    try {
      move = game.move(moveObj);
    } catch (err: any) {
      debug = `Exception: ${err?.message || err}`;
      setMoveError('Invalid move: ' + (err?.message || 'Unknown error.'));
      setGame(new Chess(prevFen));
      console.log('DEBUG: Move failed', { moveObj, legalMoves, error: err });
      return false;
    }
    if (move) {
      setMoveError(null);
      onMove(move.san);
      setGame(new Chess(game.fen()));
      setLastMoveSquares({ from: move.from, to: move.to });
      return true;
    } else {
      // Advanced rule feedback
      const fromPiece = game.get(sourceSquare as Square);
      if (!fromPiece) {
        setMoveError('No piece on that square.');
        debug = 'No piece on that square.';
      } else if (fromPiece.color !== game.turn()) {
        setMoveError("You can't move your opponent's piece.");
        debug = 'Tried to move opponent piece.';
      } else if (!isLegal) {
        const canMove = legalMoves.some(m => m.from === sourceSquare);
        if (!canMove) {
          setMoveError('This piece cannot move right now (it may be blocked or pinned).');
          debug = 'Piece cannot move (blocked or pinned).';
        } else {
          if (['b', 'r', 'q'].includes(fromPiece.type)) {
            setMoveError('That move is blocked by another piece.');
            debug = 'Path blocked.';
          } else {
            setMoveError('That move is not legal for this piece.');
            debug = 'Move not legal for this piece.';
          }
        }
      } else {
        const moveStr = legalMoves.find(m => m.from === sourceSquare && m.to === targetSquare)?.san || '';
        if (moveStr.includes('O-O')) {
          setMoveError('You cannot castle through, into, or out of check.');
          debug = 'Castling through/into check.';
        } else if (sourceSquare[1] === '7' && fromPiece && fromPiece.type === 'p' && targetSquare[1] === '8' && !moveObj.promotion) {
          setMoveError('You must promote your pawn when it reaches the last rank.');
          debug = 'Pawn promotion required.';
        } else {
          const clone = new Chess(game.fen());
          try {
            const result = clone.move(moveObj);
            if (result && clone.inCheck()) {
              setMoveError('You cannot move this piece because it would leave your king in check (pinned piece or discovered check).');
              debug = 'Move would leave king in check.';
            } else {
              setMoveError('Illegal move!');
            }
          } catch (err: any) {
            setMoveError('Illegal move!');
          }
        }
      }
      setGame(new Chess(prevFen));
      console.log('DEBUG: Move failed', { moveObj, legalMoves, debug });
    }
    return false;
  };

  // Custom board colors for theme
  const boardColors = themeColors[boardTheme] || themeColors['manly'];

  // Move hint logic
  const handleSquareClick = (square: string) => {
    // Find all legal moves from this square
    const legalMoves = game.moves({ verbose: true });
    const hints = legalMoves.filter(m => m.from === square).map(m => m.to);
    setHintSquares(hints);
  };
  const handleBoardClick = () => {
    setHintSquares([]);
  };

  // Merge move hints with last move highlights
  const customSquareStyles = {
    ...(lastMoveSquares
      ? {
          [lastMoveSquares.from]: {
            background: '#FFD700',
            boxShadow: '0 0 10px 2px #FFD700',
          },
          [lastMoveSquares.to]: {
            background: '#B22222',
            boxShadow: '0 0 10px 2px #B22222',
          },
        }
      : {}),
    ...hintSquares.reduce((acc, sq) => {
      acc[sq] = {
        background: 'radial-gradient(circle, #FFD700 60%, #BCAAA4 100%)',
        boxShadow: '0 0 8px 2px #FFD700',
      };
      return acc;
    }, {} as Record<string, any>),
  };

  // Undo move handler for solo/AI mode
  const handleUndo = () => {
    if (aiMode && onUndoAiMove) {
      onUndoAiMove();
      return;
    }
    if (!soloMode) return;
    if (moves.length === 0) return;
    const newMoves = moves.slice(0, -1);
    const chess = new Chess();
    newMoves.forEach((move) => {
      try { chess.move(move); } catch {}
    });
    setGame(chess);
    setLastMoveSquares(null);
    setMoveError(null);
  };

  const handleResign = () => {
    socket.emit('resign', window.location.pathname.replace('/', '') || 'room1');
  };
  const handleOfferDraw = () => {
    socket.emit('offerDraw', window.location.pathname.replace('/', '') || 'room1');
    setMpMessage('Draw offer sent.');
  };
  const handleDrawResponse = (accepted: boolean) => {
    socket.emit('drawResponse', { gameId: window.location.pathname.replace('/', '') || 'room1', accepted });
    setDrawOffer(null);
    setMpMessage(accepted ? 'Draw accepted.' : 'Draw declined.');
  };

  return (
    <div className="chessboard-container">
      <Chessboard
        position={game.fen()}
        onPieceDrop={handlePieceDrop}
        boardWidth={boardWidth}
        boardOrientation={boardOrientation || (playerColor === 'b' ? 'black' : 'white')}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        }}
        customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
        customLightSquareStyle={{ backgroundColor: boardColors.light }}
        customSquareStyles={customSquareStyles}
        arePiecesDraggable={!!soloMode || (!!playerColor && playerColor === turn)}
        onSquareClick={handleSquareClick}
        onMouseOutSquare={handleBoardClick}
        animationDuration={300}
      />
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', marginTop: 12 }}>
        {(soloMode || aiMode) && (
          <>
            <button onClick={handleUndo} disabled={moves.length === 0} style={{ background: '#BCAAA4', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '6px 16px', cursor: moves.length === 0 ? 'not-allowed' : 'pointer' }}>Undo Move</button>
            <button
              onClick={() => {
                if (aiMode && onRedoAiMove) onRedoAiMove();
                else if (soloMode && onRedo) onRedo();
              }}
              disabled={aiMode ? !canRedoAi : soloMode ? !canRedo : true}
              style={{ background: '#BCAAA4', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '6px 16px', cursor: (aiMode ? !canRedoAi : soloMode ? !canRedo : true) ? 'not-allowed' : 'pointer' }}
            >Redo Move</button>
          </>
        )}
        {!soloMode && !aiMode && (
          <>
            <button onClick={handleResign} style={{ background: '#B22222', color: '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>Resign</button>
            <button onClick={handleOfferDraw} style={{ background: '#4682B4', color: '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>Offer Draw</button>
          </>
        )}
        <button onClick={() => setShowHelp(true)} style={{ background: '#FFD700', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>Help</button>
      </div>
      {!soloMode && !aiMode && mpMessage && (
        <div style={{ color: '#FFD700', fontWeight: 'bold', marginTop: 8 }}>{mpMessage}</div>
      )}
      {!soloMode && !aiMode && drawOffer && (
        <div style={{ color: '#FFD700', fontWeight: 'bold', marginTop: 8 }}>
          Opponent offered a draw. Accept?
          <button onClick={() => handleDrawResponse(true)} style={{ marginLeft: 8, background: '#FFD700', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>Accept</button>
          <button onClick={() => handleDrawResponse(false)} style={{ marginLeft: 8, background: '#B22222', color: '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>Decline</button>
        </div>
      )}
      {!soloMode && !aiMode && gameOver && (
        <div style={{ color: '#FFD700', fontWeight: 'bold', marginTop: 8 }}>{gameOver}</div>
      )}
      {showHelp && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#222', color: '#FFD700', borderRadius: 12, padding: 32, maxWidth: 400, textAlign: 'left', boxShadow: '0 4px 24px #000' }}>
            <h2 style={{ marginTop: 0 }}>Chess Move Rules & Tips</h2>
            <ul style={{ color: '#FFD700', fontSize: '1em', paddingLeft: 20 }}>
              <li>Only move your own pieces on your turn.</li>
              <li>Pawns move forward, capture diagonally, and promote on the last rank.</li>
              <li>Knights jump in an L-shape. Bishops move diagonally. Rooks move straight. Queens move any direction. Kings move one square.</li>
              <li>You cannot move into or through check. Pinned pieces cannot move if it exposes your king.</li>
              <li>Castling is only allowed if neither the king nor rook has moved, the squares between are empty, and the king does not move through or into check.</li>
              <li>En passant is a special pawn capture after a two-square pawn move.</li>
              <li>If you try an illegal move, the board will reset and you'll see an explanation here.</li>
            </ul>
            <button onClick={() => setShowHelp(false)} style={{ marginTop: 16, background: '#FFD700', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChessboardComponent;