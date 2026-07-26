const path = require("path");
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// Round state lives only on the server — the source of truth for buzz order.
// buzzedNames tracks who already buzzed this round so one player can't buzz twice.
let round = {
  buzzes: [], // [{ name, time }] in the order received
};
const buzzedNames = new Set();

// Tracks names currently claimed by a connected player, so two guests can't join
// with the same name at once. Freed automatically when that socket disconnects.
const activeNames = new Map(); // key (lowercase name) -> socket.id

io.on("connection", (socket) => {
  socket.emit("state", round);

  socket.on("join", (name, ack) => {
    const cleanName = String(name || "").trim().slice(0, 30);
    const key = cleanName.toLowerCase();

    if (!cleanName) {
      ack({ ok: false, reason: "Please enter a name." });
      return;
    }
    if (activeNames.has(key) && activeNames.get(key) !== socket.id) {
      ack({ ok: false, reason: "That name is already taken. Please try another one." });
      return;
    }

    // If this socket previously joined under a different name, release it first.
    if (socket.data.nameKey && socket.data.nameKey !== key) {
      activeNames.delete(socket.data.nameKey);
    }

    activeNames.set(key, socket.id);
    socket.data.nameKey = key;
    ack({ ok: true, name: cleanName });
  });

  socket.on("buzz", (name) => {
    const cleanName = String(name || "Anonymous").trim().slice(0, 30) || "Anonymous";
    const key = cleanName.toLowerCase();

    if (buzzedNames.has(key)) return; // already buzzed this round, ignore

    buzzedNames.add(key);
    round.buzzes.push({ name: cleanName, time: Date.now() });
    io.emit("state", round);
  });

  socket.on("reset", () => {
    round = { buzzes: [] };
    buzzedNames.clear();
    io.emit("state", round);
  });

  socket.on("disconnect", () => {
    if (socket.data.nameKey && activeNames.get(socket.data.nameKey) === socket.id) {
      activeNames.delete(socket.data.nameKey);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Buzzer running on http://localhost:${PORT}`);
});
