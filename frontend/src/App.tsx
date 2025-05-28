import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import ChessboardComponent from './Chessboard';
import './App.css';
import { Chess } from 'chess.js';

const socket = io('http://localhost:4000');

const App: React.FC = () => {
  const [gameId, setGameId] = useState('room1');
  const [connected, setConnected] = useState(false);
  const [players, setPlayers] = useState(0);
  const [fen, setFen] = useState('start');
  const [moves, setMoves] = useState<string[]>([]);
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | null>(null);
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [status, setStatus] = useState<string>('');
  const [playerIDs, setPlayerIDs] = useState<string[]>([]);
  const [myID, setMyID] = useState<string>('');
  const INITIAL_TIME = 5 * 60; // 5 minutes in seconds
  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME);
  const [timerActive, setTimerActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCover, setShowCover] = useState(true);
  const [inputName, setInputName] = useState('');
  const [inputRoom, setInputRoom] = useState('room1');
  const [playerName, setPlayerName] = useState('');
  const [playerNames, setPlayerNames] = useState<{[id: string]: string}>({});
  const [mode, setMode] = useState<'online' | 'solo' | 'ai'>('online');
  const [soloFen, setSoloFen] = useState('start');
  const [soloMoves, setSoloMoves] = useState<string[]>([]);
  const [soloTurn, setSoloTurn] = useState<'w' | 'b'>('w');
  const [soloStatus, setSoloStatus] = useState('');
  const [soloBoardOrientation, setSoloBoardOrientation] = useState<'white' | 'black'>('white');
  const [aiFen, setAiFen] = useState('start');
  const [aiMoves, setAiMoves] = useState<string[]>([]);
  const [aiTurn, setAiTurn] = useState<'w' | 'b'>('w');
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState('');
  const [boardTheme, setBoardTheme] = useState<'manly' | 'classic' | 'blue' | 'green' | 'wood'>('manly');
  const [aiStarted, setAiStarted] = useState(false);
  const [soloError, setSoloError] = useState('');
  const [soloRedoStack, setSoloRedoStack] = useState<string[]>([]);
  const [aiRedoStack, setAiRedoStack] = useState<string[]>([]);

  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinGame', gameId);
    });

    socket.on('joinedGame', ({ fen, moves, color, turn, playerIDs, playerNames: namesFromServer }) => {
      setFen(fen === 'start' ? null : fen);
      setMoves(moves);
      setPlayerColor(color);
      setTurn(turn || 'w');
      if (playerIDs) setPlayerIDs(playerIDs);
      if (namesFromServer) setPlayerNames(namesFromServer);
    });

    socket.on('playerUpdate', (count) => setPlayers(count));

    socket.on('moveMade', (move, newTurn) => {
      setMoves((prev) => [...prev, move]);
      setTurn(newTurn || (turn === 'w' ? 'b' : 'w'));
    });

    socket.on('fullGame', (msg) => alert(msg));

    socket.on('playerNamesUpdate', (namesFromServer) => {
      setPlayerNames(namesFromServer);
    });

    socket.on('rematchStarted', ({ fen, moves, turn, playerIDs, playerNames: namesFromServer }) => {
      setFen(fen === 'start' ? null : fen);
      setMoves(moves);
      setTurn(turn || 'w');
      setStatus('');
      if (playerIDs) setPlayerIDs(playerIDs);
      if (namesFromServer) setPlayerNames(namesFromServer);
    });

    setMyID(socket.id || '');

    return () => {
      socket.off('connect');
      socket.off('joinedGame');
      socket.off('playerUpdate');
      socket.off('moveMade');
      socket.off('fullGame');
      socket.off('playerNamesUpdate');
      socket.off('rematchStarted');
    };
  }, [gameId]);

  useEffect(() => {
    try {
      const chess = new Chess();
      if (fen && fen !== 'start') chess.load(fen);
      moves.forEach((move) => chess.move(move));
      if (chess.isCheckmate()) {
        setStatus('Checkmate!');
      } else if (chess.isStalemate()) {
        setStatus('Stalemate!');
      } else if (chess.isCheck()) {
        setStatus('Check!');
      } else {
        setStatus('');
      }
      setError(null);
    } catch (err: any) {
      console.error('Chess.js error:', err);
      setError('A chess error occurred: ' + (err?.message || err));
    }
  }, [fen, moves]);

  const sendMove = (move: string) => {
    socket.emit('makeMove', { gameId, move });
  };

  const handleRematch = () => {
    socket.emit('rematch', gameId);
  };

  // Timer effect
  useEffect(() => {
    if (!timerActive || !playerColor) return;
    let interval: NodeJS.Timeout | null = null;
    if ((turn === 'w' && playerColor === 'w') || (turn === 'b' && playerColor === 'b')) {
      interval = setInterval(() => {
        if (turn === 'w') {
          setWhiteTime((t) => (t > 0 ? t - 1 : 0));
        } else {
          setBlackTime((t) => (t > 0 ? t - 1 : 0));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [turn, playerColor, timerActive]);

  // End game if timer runs out
  useEffect(() => {
    if (whiteTime === 0 || blackTime === 0) {
      setTimerActive(false);
      setStatus("Time's up! " + (whiteTime === 0 ? 'Black wins!' : 'White wins!'));
    }
  }, [whiteTime, blackTime]);

  // Reset timers on rematch
  useEffect(() => {
    setWhiteTime(INITIAL_TIME);
    setBlackTime(INITIAL_TIME);
    setTimerActive(true);
  }, [fen, moves.length === 0]);

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    setPlayerName(inputName.trim());
    setGameId(inputRoom.trim() || 'room1');
    setShowCover(false);
  };

  useEffect(() => {
    if (!showCover) {
      socket.emit('joinGame', gameId, playerName);
    }
  }, [showCover, gameId, playerName]);

  // Solo mode move handler
  const handleSoloMove = (move: string) => {
    setSoloError('');
    try {
      const chess = new Chess(soloFen === 'start' ? undefined : soloFen);
      const result = chess.move(move);
      if (!result) {
        setSoloError('Illegal move!');
        return;
      }
      setSoloFen(chess.fen());
      setSoloMoves((prev) => [...prev, move]);
      setSoloRedoStack([]);
      setSoloTurn(chess.turn());
      if (chess.isCheckmate()) setSoloStatus('Checkmate!');
      else if (chess.isStalemate()) setSoloStatus('Stalemate!');
      else if (chess.isCheck()) setSoloStatus('Check!');
      else setSoloStatus('');
    } catch (err: any) {
      setSoloError('Invalid move: ' + (err?.message || 'Unknown error.'));
    }
  };

  const handleSoloRematch = () => {
    setSoloFen('start');
    setSoloMoves([]);
    setSoloTurn('w');
    setSoloStatus('');
  };

  const handleSoloReset = () => {
    setSoloFen('start');
    setSoloMoves([]);
    setSoloTurn('w');
    setSoloStatus('');
  };

  const handleSoloUndo = () => {
    if (soloMoves.length === 0) return;
    setSoloRedoStack((prev) => [soloMoves[soloMoves.length - 1], ...prev]);
    const newMoves = soloMoves.slice(0, -1);
    const chess = new Chess();
    newMoves.forEach((move) => {
      try { chess.move(move); } catch {}
    });
    setSoloFen(chess.fen());
    setSoloMoves(newMoves);
    setSoloTurn(chess.turn());
    setSoloStatus('');
    setSoloError('');
  };

  const handleSoloRedo = () => {
    if (soloRedoStack.length === 0) return;
    const nextMove = soloRedoStack[0];
    const newRedo = soloRedoStack.slice(1);
    const chess = new Chess(soloFen === 'start' ? undefined : soloFen);
    try {
      chess.move(nextMove);
      setSoloFen(chess.fen());
      setSoloMoves((prev) => [...prev, nextMove]);
      setSoloRedoStack(newRedo);
      setSoloTurn(chess.turn());
      setSoloStatus('');
      setSoloError('');
    } catch {}
  };

  function getRandomMove(chess: Chess) {
    const moves = chess.moves();
    if (moves.length === 0) return null;
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const handleAiMove = (move: string) => {
    setAiError('');
    try {
      const chess = new Chess(aiFen === 'start' ? undefined : aiFen);
      const result = chess.move(move);
      if (!result) {
        setAiError('Illegal move!');
        return;
      }
      setAiFen(chess.fen());
      setAiMoves((prev) => [...prev, move]);
      setAiTurn(chess.turn());
      if (chess.isCheckmate()) setAiStatus('Checkmate!');
      else if (chess.isStalemate()) setAiStatus('Stalemate!');
      else if (chess.isCheck()) setAiStatus('Check!');
      else setAiStatus('');

      // If it's now black's turn and game not over, let AI move
      if (chess.turn() === 'b' && !chess.isGameOver()) {
        setTimeout(() => {
          const aiChess = new Chess(chess.fen());
          const aiMove = getRandomMove(aiChess);
          if (aiMove) {
            aiChess.move(aiMove);
            setAiFen(aiChess.fen());
            setAiMoves((prev) => [...prev, aiMove]);
            setAiTurn(aiChess.turn());
            if (aiChess.isCheckmate()) setAiStatus('Checkmate!');
            else if (aiChess.isStalemate()) setAiStatus('Stalemate!');
            else if (aiChess.isCheck()) setAiStatus('Check!');
            else setAiStatus('');
          }
        }, 500);
      }
    } catch (err: any) {
      setAiError('Invalid move: ' + (err?.message || 'Unknown error.'));
    }
  };

  const handleAiRematch = () => {
    setAiFen('start');
    setAiMoves([]);
    setAiTurn('w');
    setAiStatus('');
    setAiError('');
  };

  const handleAiStart = () => {
    setAiFen('start');
    setAiMoves([]);
    setAiTurn('w');
    setAiStatus('');
    setAiError('');
    setAiStarted(true);
  };

  const handleAiUndo = () => {
    if (aiMoves.length === 0) return;
    let newMoves = aiMoves.slice();
    if (newMoves.length > 0) aiRedoStack.unshift(newMoves.pop()!); // AI move
    if (newMoves.length > 0) aiRedoStack.unshift(newMoves.pop()!); // Player move
    const chess = new Chess();
    newMoves.forEach((move) => {
      try { chess.move(move); } catch {}
    });
    setAiFen(chess.fen());
    setAiMoves(newMoves);
    setAiTurn(chess.turn());
    setAiStatus('');
    setAiError('');
    setAiRedoStack([...aiRedoStack]);
  };

  const handleAiRedo = () => {
    if (aiRedoStack.length < 2) return;
    const nextPlayerMove = aiRedoStack[0];
    const nextAiMove = aiRedoStack[1];
    const newRedo = aiRedoStack.slice(2);
    const chess = new Chess(aiFen === 'start' ? undefined : aiFen);
    try {
      chess.move(nextPlayerMove);
      chess.move(nextAiMove);
      setAiFen(chess.fen());
      setAiMoves((prev) => [...prev, nextPlayerMove, nextAiMove]);
      setAiRedoStack(newRedo);
      setAiTurn(chess.turn());
      setAiStatus('');
      setAiError('');
    } catch {}
  };

  return (
    <div className="app-container">
      {showCover ? (
        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <h1 style={{ color: '#FFD700', marginBottom: 24 }}>Multiplayer Chess</h1>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <button type="button" onClick={() => setMode('online')} style={{ background: mode === 'online' ? '#FFD700' : '#222', color: mode === 'online' ? '#222' : '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '8px 20px', cursor: 'pointer' }}>Play Online</button>
            <button type="button" onClick={() => setMode('solo')} style={{ background: mode === 'solo' ? '#FFD700' : '#222', color: mode === 'solo' ? '#222' : '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '8px 20px', cursor: 'pointer' }}>Play Solo</button>
            <button type="button" onClick={() => setMode('ai')} style={{ background: mode === 'ai' ? '#FFD700' : '#222', color: mode === 'ai' ? '#222' : '#FFD700', fontWeight: 'bold', border: '2px solid #FFD700', borderRadius: 6, padding: '8px 20px', cursor: 'pointer' }}>Play vs AI</button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: '#FFD700', fontWeight: 'bold', marginRight: 8 }}>Board Theme:</label>
            <select value={boardTheme} onChange={e => setBoardTheme(e.target.value as any)} style={{ padding: 8, borderRadius: 6, fontSize: '1em' }}>
              <option value="manly">Manly</option>
              <option value="classic">Classic</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="wood">Wood</option>
            </select>
          </div>
          {mode === 'online' && (
            <>
              <input
                type="text"
                placeholder="Your Name"
                value={inputName}
                onChange={e => setInputName(e.target.value)}
                style={{ padding: 10, borderRadius: 6, border: '1px solid #BCAAA4', fontSize: '1.1em', width: 220 }}
                required
              />
              <input
                type="text"
                placeholder="Room Code (optional)"
                value={inputRoom}
                onChange={e => setInputRoom(e.target.value)}
                style={{ padding: 10, borderRadius: 6, border: '1px solid #BCAAA4', fontSize: '1.1em', width: 220 }}
              />
              <button type="submit" style={{ marginTop: 16, width: 220 }}>Join Game</button>
            </>
          )}
          {mode === 'solo' && (
            <button type="button" style={{ marginTop: 16, width: 220 }} onClick={() => setShowCover(false)}>Start Solo Game</button>
          )}
        </form>
      ) : mode === 'ai' ? (
        <>
          <h1>Chess vs AI</h1>
          {!aiStarted ? (
            <button onClick={handleAiStart} style={{ margin: '24px auto', display: 'block', background: '#FFD700', color: '#222', fontWeight: 'bold', border: '2px solid #B22222', borderRadius: 6, padding: '12px 32px', fontSize: '1.2em', cursor: 'pointer' }}>Start Game</button>
          ) : (
            <>
              {aiStatus && <p style={{ color: '#FFD700', fontWeight: 'bold' }}>{aiStatus}</p>}
              {aiError && <p style={{ color: 'red', fontWeight: 'bold' }}>{aiError}</p>}
              <ChessboardComponent
                fen={aiFen}
                moves={aiMoves}
                onMove={handleAiMove}
                playerColor={'w'}
                turn={aiTurn}
                soloMode={true}
                boardTheme={boardTheme}
                aiMode={true}
                onUndoAiMove={handleAiUndo}
                onRedoAiMove={handleAiRedo}
                canRedoAi={aiRedoStack.length >= 2}
              />
              <div style={{ marginTop: 24 }}>
                <h3 style={{ color: '#FFD700', marginBottom: 8 }}>Move History</h3>
                <ol style={{ color: '#BCAAA4', background: '#222', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
                  {aiMoves.map((move, idx) => (
                    <li key={idx}>{move}</li>
                  ))}
                </ol>
              </div>
              <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', gap: 12 }}>
                <button onClick={handleAiRematch}>Rematch</button>
                <button onClick={() => setShowCover(true)}>Back to Cover</button>
              </div>
            </>
          )}
        </>
      ) : mode === 'solo' ? (
        <>
          <h1>Solo Chess</h1>
          {soloStatus && <p style={{ color: '#FFD700', fontWeight: 'bold' }}>{soloStatus}</p>}
          {soloError && <p style={{ color: 'red', fontWeight: 'bold' }}>{soloError}</p>}
          <ChessboardComponent
            fen={soloFen}
            moves={soloMoves}
            onMove={handleSoloMove}
            playerColor={soloTurn}
            turn={soloTurn}
            soloMode={true}
            boardOrientation={soloBoardOrientation}
            boardTheme={boardTheme}
            onUndo={handleSoloUndo}
            onRedo={handleSoloRedo}
            canRedo={soloRedoStack.length > 0}
          />
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: '#FFD700', marginBottom: 8 }}>Move History</h3>
            <ol style={{ color: '#BCAAA4', background: '#222', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
              {soloMoves.map((move, idx) => (
                <li key={idx}>{move}</li>
              ))}
            </ol>
          </div>
          <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', gap: 12 }}>
            <button onClick={handleSoloRematch}>Rematch</button>
            <button onClick={handleSoloReset}>Reset Solo Game</button>
            <button onClick={() => setSoloBoardOrientation(o => o === 'white' ? 'black' : 'white')}>Flip Board</button>
            <button onClick={() => setShowCover(true)}>Back to Cover</button>
          </div>
        </>
      ) : (
        <>
          {error && <div style={{ color: 'red', fontWeight: 'bold', marginBottom: 16 }}>{error}</div>}
          <h1>Multiplayer Chess</h1>
          <p>Game ID: {gameId}</p>
          <p>Players connected: {players}</p>
          {playerColor && (
            <p>Your color: <span style={{ color: playerColor === 'w' ? '#FFD700' : '#B22222', fontWeight: 'bold' }}>{playerColor === 'w' ? 'White' : 'Black'}</span></p>
          )}
          <p>Turn: <span style={{ color: turn === 'w' ? '#FFD700' : '#B22222', fontWeight: 'bold' }}>{turn === 'w' ? 'White' : 'Black'}</span></p>
          {status && <p style={{ color: '#FFD700', fontWeight: 'bold' }}>{status}</p>}
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 0', background: '#181818', borderRadius: 8, padding: 12 }}>
            <div>
              <h3 style={{ color: '#FFD700', margin: 0, marginBottom: 8 }}>Players</h3>
              {playerIDs.map((id, idx) => (
                <div key={id} style={{ color: idx === 0 ? '#FFD700' : '#B22222', fontWeight: myID === id ? 'bold' : 'normal' }}>
                  {myID === id ? 'You' : `Opponent`} ({idx === 0 ? 'White' : 'Black'})<br />
                  <span style={{ fontSize: '1em', color: '#FFD700' }}>{playerNames[id] || id}</span>
                  <br />
                  <span style={{ fontSize: '0.85em', color: '#BCAAA4' }}>{id}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
              <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.1em' }}>White: {formatTime(whiteTime)}</div>
              <div style={{ color: '#B22222', fontWeight: 'bold', fontSize: '1.1em' }}>Black: {formatTime(blackTime)}</div>
            </div>
          </div>
          <ChessboardComponent
            fen={fen}
            moves={moves}
            onMove={(move) => sendMove(move)}
            playerColor={playerColor}
            turn={turn}
            boardTheme={boardTheme}
          />
          <div style={{ marginTop: 24 }}>
            <h3 style={{ color: '#FFD700', marginBottom: 8 }}>Move History</h3>
            <ol style={{ color: '#BCAAA4', background: '#222', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
              {moves.map((move, idx) => (
                <li key={idx}>{move}</li>
              ))}
            </ol>
          </div>
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            <button
              onClick={handleRematch}
              disabled={!status || (status !== 'Checkmate!' && status !== 'Stalemate!')}
              style={{ opacity: (!status || (status !== 'Checkmate!' && status !== 'Stalemate!')) ? 0.5 : 1 }}
            >
              Rematch
            </button>
          </div>
          <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCover(true)}>Back to Cover</button>
          </div>
        </>
      )}
    </div>
  );
};

export default App;