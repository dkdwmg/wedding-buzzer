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

io.on("connection", (socket) => {
  socket.emit("state", round);

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
});

server.listen(PORT, () => {
  console.log(`Buzzer running on http://localhost:${PORT}`);
});
