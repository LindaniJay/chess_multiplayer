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

  const handleAiStart = () => {
    setAiFen('start');
    setAiMoves([]);
    setAiTurn('w');
    setAiStatus('');
    setAiError('');
    setAiStarted(true);
    setAiRedoStack([]);
  };

  const handleAiRematch = () => {
    setAiFen('start');
    setAiMoves([]);
    setAiTurn('w');
    setAiStatus('');
    setAiError('');
    setAiStarted(true);
    setAiRedoStack([]);
  };

  const handleAiBackToCover = () => {
    setAiStarted(false);
    setAiFen('start');
    setAiMoves([]);
    setAiTurn('w');
    setAiStatus('');
    setAiError('');
    setAiRedoStack([]);
    setShowCover(true);
  };

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
      setAiRedoStack([]);
      setAiTurn(chess.turn());
      if (chess.isCheckmate()) setAiStatus('Checkmate!');
      else if (chess.isStalemate()) setAiStatus('Stalemate!');
      else if (chess.isCheck()) setAiStatus('Check!');
      else setAiStatus('');
      if (chess.turn() === 'b' && !chess.isGameOver()) {
        setTimeout(() => {
          const aiChess = new Chess(chess.fen());
          const aiMove = getRandomMove(aiChess);
          if (aiMove) {
            aiChess.move(aiMove);
            setAiFen(aiChess.fen());
            setAiMoves((prev) => [...prev, aiMove]);
            setAiTurn(aiChess.turn());
            setAiStatus('');
            setAiError('');
          }
        }, 500);
      }
    } catch (err: any) {
      setAiError('Invalid move: ' + (err?.message || 'Unknown error.'));
    }
  };

  const handleAiUndo = () => {
    if (aiMoves.length < 2) return;
    let newMoves = aiMoves.slice(0, -2);
    setAiRedoStack((prev) => [aiMoves[aiMoves.length - 2], aiMoves[aiMoves.length - 1], ...prev]);
    const chess = new Chess();
    newMoves.forEach((move) => {
      try { chess.move(move); } catch {}
    });
    setAiFen(chess.fen());
    setAiMoves(newMoves);
    setAiTurn(chess.turn());
    setAiStatus('');
    setAiError('');
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

  // Helper for DiceBear avatar URL
  function getAvatarUrl(nameOrId: string) {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nameOrId)}`;
  }

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="tab-bar">
          <button className={`tab${mode === 'online' ? ' selected' : ''}`} onClick={() => setMode('online')}>New Game</button>
          <button className="tab">Games</button>
          <button className="tab">Players</button>
        </div>
        {/* Sidebar controls based on mode */}
        {mode === 'online' && (
          <>
            <button className="big-btn" onClick={() => setShowCover(true)}>Join Game</button>
            <div className="sidebar-section">
              <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: 8 }}>Room Code: {gameId} <button title="Copy Room Code" style={{marginLeft: 8}} onClick={() => {navigator.clipboard.writeText(gameId)}}>📋</button></div>
              <div style={{ color: '#BCAAA4', marginBottom: 8 }}>Players connected: {players}</div>
              {playerColor && (
                <div style={{ color: playerColor === 'w' ? '#FFD700' : '#B22222', fontWeight: 'bold', marginBottom: 8 }}>Your color: {playerColor === 'w' ? 'White' : 'Black'}</div>
              )}
              <div style={{ color: '#BCAAA4', marginBottom: 8 }}>Turn: <span style={{ color: turn === 'w' ? '#FFD700' : '#B22222', fontWeight: 'bold' }}>{turn === 'w' ? 'White' : 'Black'}</span></div>
              {status && <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: 8 }}>{status}</div>}
              <button className="sidebar-btn" onClick={handleRematch} disabled={!status || (status !== 'Checkmate!' && status !== 'Stalemate!')}>Rematch</button>
              <button className="sidebar-btn" onClick={() => setShowCover(true)} title="Leave Game">⬅️ Leave Game</button>
            </div>
          </>
        )}
        {mode === 'solo' && (
          <>
            <button className="big-btn" onClick={handleSoloRematch}>Rematch</button>
            <button className="sidebar-btn" onClick={handleSoloReset}>Reset Solo Game</button>
            <button className="sidebar-btn" onClick={() => setSoloBoardOrientation(o => o === 'white' ? 'black' : 'white')}>Flip Board</button>
            <button className="sidebar-btn" onClick={() => setShowCover(true)} title="Back to Menu">⬅️ Back to Menu</button>
          </>
        )}
        {mode === 'ai' && (
          <>
            <button className="big-btn" onClick={handleAiRematch}>Rematch</button>
            <button className="sidebar-btn" onClick={handleAiBackToCover} title="Back to Menu">⬅️ Back to Menu</button>
          </>
        )}
        <div className="sidebar-section">
          <label style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: 8 }}>Board Theme:</label>
          <select className="dropdown" value={boardTheme} onChange={e => setBoardTheme(e.target.value as any)}>
            <option value="manly">Manly</option>
            <option value="classic">Classic</option>
            <option value="blue">Blue</option>
            <option value="green">Green</option>
            <option value="wood">Wood</option>
          </select>
        </div>
        <button className="sidebar-btn" title="How to Play / Help" onClick={() => alert('How to play: Standard chess rules. Use the sidebar to start or join games, and the board area to play!')}>❓ Help</button>
        <div className="stats-bar">
          <span>189,349 PLAYING</span>
          <span>18,549,084 GAMES TODAY</span>
        </div>
      </div>
      {/* Board Area */}
      <div className="board-area">
        {/* Opponent Info */}
        <div className="player-info">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {mode === 'ai' ? (
              <div className="avatar" title="AI">🤖</div>
            ) : (
              <img className="avatar" src={mode === 'online' ? getAvatarUrl(playerNames[playerIDs[1]] || playerIDs[1] || 'opponent') : getAvatarUrl('opponent')} alt="Opponent Avatar" />
            )}
            <span>{mode === 'online' ? (playerNames[playerIDs[1]] || 'Opponent') : mode === 'ai' ? 'AI' : 'Opponent'}</span>
          </div>
          <div className="timer">{mode === 'online' ? formatTime(blackTime) : mode === 'ai' ? formatTime(blackTime) : ''}</div>
        </div>
        {/* Chessboard with border */}
        <div className="board-border">
          {mode === 'online' && (
            <ChessboardComponent
              fen={fen}
              moves={moves}
              onMove={sendMove}
              playerColor={playerColor}
              turn={turn}
              boardTheme={boardTheme}
            />
          )}
          {mode === 'solo' && (
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
          )}
          {mode === 'ai' && aiStarted && (
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
          )}
        </div>
        {/* Your Info */}
        <div className="player-info">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img className="avatar" src={getAvatarUrl(playerName || myID || 'you')} alt="Your Avatar" />
            <span>{playerName || 'You'}</span>
          </div>
          <div className="timer">{mode === 'online' ? formatTime(whiteTime) : mode === 'ai' ? formatTime(whiteTime) : ''}</div>
        </div>
        {/* Move History */}
        <div style={{ marginTop: 24, width: '100%' }}>
          <h3 style={{ color: '#FFD700', marginBottom: 8 }}>Move History</h3>
          <ol style={{ color: '#BCAAA4', background: '#222', borderRadius: 8, padding: 12, maxHeight: 200, overflowY: 'auto' }}>
            {(mode === 'online' ? moves : mode === 'solo' ? soloMoves : aiMoves).map((move, idx) => (
              <li key={idx}>{move}</li>
            ))}
          </ol>
        </div>
      </div>
      {/* Cover Modal Overlay */}
      {showCover && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: '#222', borderRadius: 16, padding: 40, boxShadow: '0 4px 32px #000' }}>
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
            {mode === 'ai' && (
              <button
                type="button"
                style={{ marginTop: 16, width: 220 }}
                onClick={() => {
                  setShowCover(false);
                  handleAiStart();
                }}
              >
                Start Game
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
};

export default App;