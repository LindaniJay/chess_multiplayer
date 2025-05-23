# ♟️ Multiplayer Chess Game (WIP)

This is a full-stack multiplayer chess application built with:

- 🧠 **Frontend**: React + TypeScript + Socket.io client
- 🔌 **Backend**: Node.js + Express + Socket.io
- ♟️ **Chess logic**: [`chess.js`](https://github.com/jhlywa/chess.js) for move validation and game state

---

## 🚀 Features

- Real-time multiplayer chess via Socket.io
- Basic game room setup (default: `room1`)
- Chessboard placeholder UI (ready to be upgraded with animations, highlights, timers)
- Server relays valid moves to the opponent

---

## 📦 Getting Started

### 🔧 Backend

```bash
cd backend
npm install
npm start
```

Starts the Socket.io server on `http://localhost:4000`.

---

### 💻 Frontend

```bash
cd frontend
npm install
npm start
```

Starts React dev server at `http://localhost:3000`.

> Note: Ensure `public/index.html` and `src/index.tsx` exist and are properly configured.

---

## 📌 Todo / In Progress

- ✅ Set up multiplayer socket communication
- ⬜ Add full-featured chessboard with drag-drop, move highlighting, check/checkmate states
- ⬜ Sync FEN/move history and enforce turns
- ⬜ Add player names, rematch, timers, undo, and draw requests
- ⬜ Add AI opponent via Stockfish or Minimax
- ⬜ Add lobby/matchmaking system
- ⬜ Improve game UI/UX

---

## 🤝 Contributing

This project is a **work in progress** and open for contributions!

If you're passionate about chess, multiplayer games, or full-stack web apps — you're welcome to contribute.

Feel free to fork, submit PRs, or reach out with ideas.

**my email-lindanijonase@gmail.com**

---

## 🧠 Credits

- `chess.js` – robust JS chess logic engine
- `react`, `socket.io`, `express` – for frontend and server communication

---

## 📜 License

MIT — open and free to use
