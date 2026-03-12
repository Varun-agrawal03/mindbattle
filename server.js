/**
 * ============================================================
 *  MINDBATTLE — Online Multiplayer Server v2.0
 *  Text Chat + Voice Chat (WebRTC Signaling)
 * ============================================================
 */

const express = require("express");
const http    = require("http");
const { Server } = require("socket.io");
const path    = require("path");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

function createRoom(roomCode, hostSocket, hostName) {
  return {
    code: roomCode,
    players: {
      1: { socketId: hostSocket.id, name: hostName, secret: null, ready: false },
      2: null,
    },
    settings:    { rangeMin: 1, rangeMax: 100 },
    state:       "waiting",
    currentTurn: 1,
    guessCount:  0,
    history:     [],
    chat:        [],
  };
}

function makeRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms[code] ? makeRoomCode() : code;
}

function findRoomBySocket(socketId) {
  for (const code in rooms) {
    const r = rooms[code];
    if (r.players[1]?.socketId === socketId || r.players[2]?.socketId === socketId)
      return { room: r, code };
  }
  return null;
}

function getPlayerNum(room, socketId) {
  if (room.players[1]?.socketId === socketId) return 1;
  if (room.players[2]?.socketId === socketId) return 2;
  return null;
}

function emitToRoom(code, event, data) { io.to(code).emit(event, data); }

function getOtherSocket(room, mySocketId) {
  const n = getPlayerNum(room, mySocketId);
  const o = n === 1 ? 2 : 1;
  return room.players[o]?.socketId || null;
}

io.on("connection", (socket) => {
  console.log(`+ Connected: ${socket.id}`);

  socket.on("create_room", ({ playerName, rangeMin, rangeMax }) => {
    const code = makeRoomCode();
    const room = createRoom(code, socket, playerName || "PLAYER 1");
    room.settings.rangeMin = rangeMin || 1;
    room.settings.rangeMax = rangeMax || 100;
    rooms[code] = room;
    socket.join(code);
    socket.emit("room_created", { code, playerNum: 1, settings: room.settings });
    console.log(`Room created: ${code}`);
  });

  socket.on("join_room", ({ roomCode, playerName }) => {
    const code = roomCode.toUpperCase().trim();
    const room = rooms[code];
    if (!room)                    { socket.emit("error_msg", "Room not found!"); return; }
    if (room.players[2])          { socket.emit("error_msg", "Room is full!"); return; }
    if (room.state !== "waiting") { socket.emit("error_msg", "Game already started!"); return; }
    room.players[2] = { socketId: socket.id, name: playerName || "PLAYER 2", secret: null, ready: false };
    socket.join(code);
    emitToRoom(code, "room_ready", { code, p1Name: room.players[1].name, p2Name: room.players[2].name, settings: room.settings });
    io.to(room.players[1].socketId).emit("your_player_num", { num: 1 });
    io.to(room.players[2].socketId).emit("your_player_num", { num: 2 });
    room.state = "picking";
    console.log(`${playerName} joined ${code}`);
  });

  socket.on("set_secret", ({ secret }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;
    const pNum = getPlayerNum(room, socket.id);
    if (!pNum) return;
    const { rangeMin, rangeMax } = room.settings;
    if (secret < rangeMin || secret > rangeMax) { socket.emit("error_msg", `Between ${rangeMin}-${rangeMax}`); return; }
    room.players[pNum].secret = secret;
    room.players[pNum].ready  = true;
    socket.emit("secret_locked", { playerNum: pNum });
    const other = getOtherSocket(room, socket.id);
    if (other) io.to(other).emit("opponent_ready");
    if (room.players[1].ready && room.players[2].ready) {
      room.state = "playing";
      emitToRoom(code, "game_start", { currentTurn: 1, p1Name: room.players[1].name, p2Name: room.players[2].name });
    }
  });

  socket.on("make_guess", ({ guess }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;
    if (room.state !== "playing") return;
    const pNum = getPlayerNum(room, socket.id);
    if (room.currentTurn !== pNum) { socket.emit("error_msg", "Not your turn!"); return; }
    const { rangeMin, rangeMax } = room.settings;
    if (guess < rangeMin || guess > rangeMax) { socket.emit("error_msg", `Between ${rangeMin}-${rangeMax}`); return; }
    const oppNum = pNum === 1 ? 2 : 1;
    room.guessCount++;
    const result = guess === room.players[oppNum].secret ? "correct" : guess < room.players[oppNum].secret ? "higher" : "lower";
    const entry  = { playerNum: pNum, playerName: room.players[pNum].name, guess, result, guessCount: room.guessCount };
    room.history.push(entry);
    if (result === "correct") {
      room.state = "done";
      emitToRoom(code, "guess_result", entry);
      emitToRoom(code, "game_over", { winnerNum: pNum, winnerName: room.players[pNum].name, secret: room.players[oppNum].secret, guessCount: room.guessCount });
    } else {
      room.currentTurn = oppNum;
      emitToRoom(code, "guess_result", entry);
      emitToRoom(code, "turn_change", { currentTurn: room.currentTurn });
    }
  });

  socket.on("play_again", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;
    [1,2].forEach(n => { room.players[n].secret = null; room.players[n].ready = false; });
    room.state = "picking"; room.currentTurn = 1; room.guessCount = 0; room.history = [];
    emitToRoom(code, "new_round", { settings: room.settings });
  });

  // ── TEXT CHAT ─────────────────────────────────────────────
  // Socket.io makes this easy: receive msg → validate → relay to room
  socket.on("chat_msg", ({ text }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;
    if (!text || typeof text !== "string") return;
    const clean = text.trim().slice(0, 200);
    if (!clean) return;
    const pNum = getPlayerNum(room, socket.id);
    const msg = {
      from:      room.players[pNum]?.name || "Unknown",
      playerNum: pNum,
      text:      clean,
      time:      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }),
    };
    room.chat.push(msg);
    if (room.chat.length > 50) room.chat.shift();
    emitToRoom(code, "chat_msg", msg);   // relay to both players
    console.log(`Chat [${code}] ${msg.from}: ${clean}`);
  });

  socket.on("chat_typing", ({ isTyping }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room } = found;
    const pNum  = getPlayerNum(room, socket.id);
    const other = getOtherSocket(room, socket.id);
    if (other) io.to(other).emit("chat_typing", { name: room.players[pNum]?.name, isTyping });
  });

  // ── WEBRTC SIGNALING (Voice Chat) ─────────────────────────
  // The server is just a relay — it never touches audio.
  // It only forwards SDP offer/answer and ICE candidates
  // so the two browsers can establish a direct connection.

  socket.on("webrtc_offer", ({ offer }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const other = getOtherSocket(found.room, socket.id);
    if (other) { io.to(other).emit("webrtc_offer", { offer }); console.log(`WebRTC offer → ${found.code}`); }
  });

  socket.on("webrtc_answer", ({ answer }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const other = getOtherSocket(found.room, socket.id);
    if (other) { io.to(other).emit("webrtc_answer", { answer }); console.log(`WebRTC answer → ${found.code}`); }
  });

  socket.on("webrtc_ice", ({ candidate }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const other = getOtherSocket(found.room, socket.id);
    if (other) io.to(other).emit("webrtc_ice", { candidate });
  });

  socket.on("voice_ended", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const other = getOtherSocket(found.room, socket.id);
    if (other) io.to(other).emit("voice_ended");
  });

  socket.on("disconnect", () => {
    console.log(`- Disconnected: ${socket.id}`);
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, code } = found;
    emitToRoom(code, "opponent_left", { message: "Your opponent disconnected!" });
    setTimeout(() => { delete rooms[code]; }, 5000);
  });
});

server.listen(PORT, () => {
  console.log(`\nMindBattle v2 running on http://localhost:${PORT}\n`);
});
