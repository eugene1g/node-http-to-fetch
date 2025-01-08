import { consumeRequestBody } from "./utils.ts";
import { installRequestLoop } from "../src/install.ts";
import type { NetInfo } from "../src/types.ts";

import { readFileSync } from "node:fs";
import { createSecureServer } from "node:http2";
import { setTimeout } from "node:timers/promises";
import type { Http2SecureServer, ServerHttp2Session } from "node:http2";
import type { Duplex } from "node:stream";

export type TestServer<T = Http2SecureServer> = {
  getUrl(): Promise<URL>;
  start(): Promise<URL>;
  stop(): Promise<void>;
  get _instance(): T;
  get hadConnections(): number;
};

export const testServers = {
  h2(): TestServer {
    let openSessions = new Set<ServerHttp2Session>();
    let openSockets = new Set<Duplex>();
    let numConnections = 0;
    const http2server = createSecureServer({
      key: readFileSync(
        new URL("certs/localhost-privkey.pem", import.meta.url),
      ),
      cert: readFileSync(new URL("certs/localhost-cert.pem", import.meta.url)),
      allowHTTP1: true,
    })
      .on("error", (err) => console.error(err))
      .on("connection", (socket: Duplex) => {
        numConnections++;
        openSockets.add(socket);
        // Tracking and closing connections/sockets is required because the server supports HTTP1 connections which are not tracked in the session event
        socket.on("close", () => openSockets.delete(socket));
      })
      .on("session", (sess) => {
        // console.log("[server] new session");
        // Have to keep track of session to cleanly close the server later
        openSessions.add(sess);
        sess.on("close", () => openSessions.delete(sess));
      });
    installRequestLoop(http2server, standardTestLoop);

    return {
      get hadConnections() {
        return numConnections;
      },
      get _instance() {
        return http2server;
      },
      async start() {
        // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
        const ipVersionOnly: 4 | 6 | undefined | number = undefined;
        await new Promise<void>((resolve) =>
          http2server.listen(
            {
              port: null,
              host: "::", // on most OS, this will make the server listen on both IPv4 and IPv6
              ...(ipVersionOnly === 4 ? { host: "0.0.0.0" } : {}),
              ...(ipVersionOnly === 6
                ? { host: undefined, ipv6Only: true }
                : {}),
            },
            () => resolve(),
          ),
        );
        return this.getUrl();
      },
      async getUrl() {
        if (!http2server.listening) await this.start();
        let host = "localhost";
        // @ts-expect-error bad types for port
        return new URL(`https://${host}:${http2server.address().port}`);
      },
      async stop() {
        // BugAlert: For HTTP2 server, need to manually close all streams and connections before closing the server
        // Force shutdown for all sessions
        const closePromise = new Promise<void>((resolve) =>
          http2server.close(() => resolve()),
        ).catch((error) => {
          console.error(`err during shutdown`, error);
        });
        // console.log(`[server] closing ${openSessions.size} sessions...`);
        for (const sess of openSessions) sess.close();
        // console.log(`[server] closing ${openSockets.size} sockets...`);
        for (const socket of openSockets) socket.end();
        return closePromise;
      },
    };
  },
};

/**
 * Handler for HTTP2 and HTTP1 requests
 */
async function standardTestLoop(req: Request, httpCtx: { net: NetInfo }) {
  if (req.url.endsWith("emptyResponse"))
    return new Response(null, { status: 202 });
  const bodyContent = req.body ? await consumeRequestBody(req) : null;
  const sendBody = JSON.stringify({
    url: req.url,
    qs: Object.fromEntries(new URL(req.url).searchParams.entries()),
    scheme: new URL(req.url).protocol.slice(0, -1), // remove the last ":" from the protocol
    method: req.method,
    net: httpCtx.net,
    postBody: bodyContent?.toString() ?? null,
    headers: Object.fromEntries(req.headers.entries()),
    // handlerApi: httpCtx.api,
  });
  await setTimeout(20); // pretend to do some work. This also helps to test behavior of other listeners that might return a Response quicker or slower than this
  return new Response(sendBody);
}
