import { Server } from "socket.io";
import { hashToken } from "./util.js";
import { verifyToken } from "./auth.js";

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    serveClient: false,
  });

  io.on("connection", (socket) => {
    const payload = verifyToken(socket.handshake.auth?.token);
    if (payload?.rid) {
      socket.join(`restaurant:${payload.rid}`);
    }

    socket.on("watch:order", (data) => {
      const token = typeof data === "string" ? data : data?.token;
      if (typeof token === "string" && token.length >= 12) {
        socket.join(`order:${token}`);
      }
    });

    socket.on("watch:payment", (data) => {
      const token = typeof data === "string" ? data : data?.token;
      if (typeof token === "string" && token.length >= 12) {
        socket.join(`payment:${hashToken(token)}`);
      }
    });

    socket.on("unwatch", (room) => {
      if (typeof room === "string" && room.startsWith("watch:")) socket.leave(room.slice(6));
    });
  });

  return io;
}

export function emit(channel, event, payload) {
  if (!io) return;
  io.to(channel).emit(event, payload);
}

export function emitToRestaurant(restaurantId, event, payload) {
  emit(`restaurant:${restaurantId}`, event, payload);
}
