# 🧠 MindBattle v2 — Online Number Duel

> A real-time 2-player online number guessing game with **live text chat** and **voice calling**.  
> Pick a secret number, take turns guessing, trash-talk your opponent — first to crack the code wins!

Built with **Node.js · Express · Socket.io · WebRTC**

---

## ✨ Features

| Feature | Technology | How it works |
|---|---|---|
| 🎮 Real-time gameplay | Socket.io (WebSocket) | Server relays game events to both players instantly |
| 💬 Text chat | Socket.io | Messages sent to server → broadcast to room |
| 🎤 Voice chat | WebRTC (peer-to-peer) | Audio flows directly browser↔browser, server only does signaling |
| ⌨️ Typing indicator | Socket.io | Emits typing state to opponent in real time |
| 🏠 Room system | In-memory store | 6-digit codes isolate each game session |

---

## 🎮 How to Play

1. **Player 1** creates a room and sets the number range (e.g. 1–100)
2. A **6-digit room code** is generated — share it with your friend
3. **Player 2** joins using that code
4. Both players **secretly pick a number** within the range
5. Take turns **guessing** the opponent's number
6. After each guess the server hints: go **HIGHER ↑** or **LOWER ↓**
7. Use **text chat** to taunt your opponent 😈
8. Start a **voice call** to hear their pain in real time 🎤
9. First to guess correctly **wins the round!** 🏆

---

## 📁 Project Structure

```
mindbattle/
├── server.js          ← Backend (Node.js + Express + Socket.io)
├── package.json       ← Dependencies & scripts
├── README.md          ← You are here
└── public/
    └── index.html     ← Frontend (HTML + CSS + JS, all in one file)
```

---

## 🚀 Run Locally

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/mindbattle.git
cd mindbattle

# 2. Install dependencies
npm install

# 3. Start the server
node server.js

# 4. Open in browser
# http://localhost:3000
```

Open the URL in **two browser tabs** to test both players yourself.

---

## 🌐 Play With Friends Online

### ⚡ Option 1 — ngrok (Play right now, free)

Runs on your PC but gives a public URL anyone can open.

```bash
# Terminal 1 — start the game server
node server.js

# Terminal 2 — create a public tunnel
ngrok http 3000
```

Share the `https://xxxx.ngrok-free.app` link. Done!  
Get ngrok free at [ngrok.com](https://ngrok.com)

> ✅ Voice chat works on ngrok (HTTPS is required for microphone access)

---

### 🚂 Option 2 — Railway (Permanent URL, recommended)

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **Start a New Project**
3. Click **Deploy from GitHub repo** → select `mindbattle`
4. Go to **Settings → Generate Domain** → get your public URL
5. Share with friends — game is live 24/7!

> ✅ Auto-redeploys on every GitHub push  
> ✅ HTTPS included — voice chat works perfectly  
> ✅ `process.env.PORT` already handled in `server.js`

---

## 🔧 Troubleshooting

### `EADDRINUSE` — Port 3000 already in use

Another Node process is already running. Kill it first:

```powershell
# Windows — find and kill the process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
node server.js
```

```bash
# Mac / Linux
lsof -ti:3000 | xargs kill -9
node server.js
```

Or just use a different port — change `3000` to `3001` in `server.js`.

---

### Voice chat not working

| Symptom | Cause | Fix |
|---|---|---|
| "Mic permission denied" | Browser blocked microphone | Click the 🔒 icon in address bar → Allow microphone |
| No sound from opponent | HTTP instead of HTTPS | Use ngrok or Railway (both provide HTTPS) |
| Call connects but no audio | Firewall blocking WebRTC | Add TURN servers (see below) |

> ⚠️ **Voice chat requires HTTPS.** It works on `localhost`, ngrok, and Railway automatically. It will NOT work on plain `http://YOUR_IP:3000`.

---

### For voice behind strict firewalls — add TURN servers

By default voice uses Google's free STUN servers which work for most networks. If players are behind very strict corporate firewalls, you may need TURN servers. In `public/index.html`, find this section and add your TURN credentials:

```js
const ICE = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN server here for strict firewalls:
    // {
    //   urls: 'turn:YOUR_TURN_SERVER',
    //   username: 'YOUR_USERNAME',
    //   credential: 'YOUR_PASSWORD'
    // }
  ]
};
```

Free TURN servers are available at [Metered.ca](https://www.metered.ca/tools/openrelay/) and [Xirsys](https://xirsys.com).

---

## 🎓 How It Works (Technical)

### WebSocket Flow (Game + Chat)

```
Player 1 Browser          Server              Player 2 Browser
      │                     │                       │
      │── create_room ──────►│                       │
      │◄── room_created ─────│                       │
      │                     │◄─────── join_room ─────│
      │◄── room_ready ───────┼──── room_ready ───────►│
      │── set_secret ───────►│◄──────── set_secret ───│
      │◄── game_start ───────┼──── game_start ───────►│
      │── make_guess ───────►│                       │
      │◄── guess_result ─────┼──── guess_result ─────►│
      │── chat_msg ─────────►│                       │
      │◄── chat_msg ─────────┼──── chat_msg ──────────►│
```

### WebRTC Signaling Flow (Voice)

The server only helps the two browsers find each other — it never touches audio.

```
Player 1                  Server               Player 2
   │                        │                     │
   │  getUserMedia() 🎤      │                     │
   │  createOffer (SDP)      │                     │
   │── webrtc_offer ────────►│── webrtc_offer ────►│
   │                        │  createAnswer (SDP)  │
   │◄── webrtc_answer ───────│◄─ webrtc_answer ─────│
   │── webrtc_ice ──────────►│── webrtc_ice ───────►│
   │◄── webrtc_ice ──────────│◄─ webrtc_ice ─────────│
   │                        │                     │
   │◄═══════ DIRECT AUDIO (peer-to-peer) ══════════►│
```

### Key Security Note
Secret numbers are stored **server-side only**. The opponent's browser never receives your secret directly — the server only replies "higher" or "lower" to each guess.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Server runtime | Node.js |
| HTTP server | Express |
| Real-time events | Socket.io (WebSockets) |
| Voice audio | WebRTC (browser built-in) |
| Frontend | Vanilla HTML + CSS + JavaScript |

---

## 📜 License

MIT — free to use, modify, and share.
