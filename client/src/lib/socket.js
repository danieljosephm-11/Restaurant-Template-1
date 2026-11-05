import { io } from "socket.io-client";

let socket = null;
let currentToken = null;

export function getSocket(token = null) {
  const key = token || "__anonymous__";
  if (socket && currentToken === key) return socket;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = key;
  socket = io("/", {
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 8,
  });
  return socket;
}

export function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
  currentToken = null;
}

export function watchOrder(socket, token) {
  if (!socket || !token) return () => {};
  socket.emit("watch:order", { token });
  return () => socket.emit("unwatch", `watch:order:${token}`);
}

export function watchPayment(socket, token) {
  if (!socket || !token) return () => {};
  socket.emit("watch:payment", { token });
  return () => socket.emit("unwatch", `watch:payment:${token}`);
}

export function watchRestaurant(socket) {
  // The server joins authenticated sockets to restaurant:<id> automatically.
  return () => {};
}
