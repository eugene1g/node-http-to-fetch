import { testServers } from "./servers.ts";

import { test } from "node:test";
import WebSocket, { WebSocketServer } from "ws";
import { deepEqual } from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

await test("Can upgrade WebSocket connection", async () => {
  const testServer = testServers.h2();
  const messageToSend = "howdy folks!";
  let receivedMessage = "";

  const wss1 = new WebSocketServer({ noServer: true }).on(
    "connection",
    (client) => {
      client
        .on("error", console.error)
        .on("message", (data) => (receivedMessage = String(data)));
    },
  );
  testServer._instance.on("upgrade", (request, socket, head) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    wss1.handleUpgrade(request, socket, head, (ws) => {
      wss1.emit("connection", ws, request);
    });
  });

  await testServer.start();
  const wsClient = new WebSocket(
    new URL("/websocket1", await testServer.getUrl()).href.replace(
      "http",
      "ws",
    ),
    { rejectUnauthorized: false },
  )
    .on("error", console.error)
    .on("open", () => {
      wsClient.send(messageToSend, () => wsClient.close());
    });

  await setTimeout(30);
  if (receivedMessage === "") await setTimeout(70); // sometimes messages take a long time to arrive in a busy CI box. Maybe report this as a failure too?
  wss1.close(); // stop WebSocketServer
  await testServer.stop();
  deepEqual(receivedMessage, messageToSend);
});
