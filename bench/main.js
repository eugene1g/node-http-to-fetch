#!/usr/bin/env node
import { createServer } from "node:http";
import { createSecureServer } from "node:http2";
import { readFileSync } from "node:fs";
import { installRequestLoop } from "../dist/main.js";

const rawHttp1 = createServer({ keepAlive: true }).on("request", plainHandler);
const rawHttp2 = createSecureServer({
  keepAlive: true,
  key: readFileSync(new URL("../__tests__/certs/localhost-privkey.pem", import.meta.url)),
  cert: readFileSync(new URL("../__tests__/certs/localhost-cert.pem", import.meta.url)),
  allowHTTP1: true,
}).on("request", plainHandler);

/**
 * Now setup using our magic handler
 */
const magicHttp1 = createServer({ keepAlive: true }).on("request", magicHandler);
installRequestLoop(magicHttp1, magicHandler);

const magicHttp2 = createSecureServer({
  keepAlive: true,
  key: readFileSync(new URL("../__tests__/certs/localhost-privkey.pem", import.meta.url)),
  cert: readFileSync(new URL("../__tests__/certs/localhost-cert.pem", import.meta.url)),
  allowHTTP1: true,
});
installRequestLoop(magicHttp2, magicHandler);

rawHttp1.listen(42001, () => console.log("Raw HTTP/1.1 server listening on port 42001"));
rawHttp2.listen(42002, () => console.log("Raw HTTP2 server listening on port 42002"));
magicHttp1.listen(43001, () => console.log("Magic HTTP/1.1 server listening on port 43001"));
magicHttp2.listen(43002, () => console.log("Magic HTTP2 server listening on port 43002"));

function plainHandler(req, res) {
  // Lines below are used to simulate most of the work in the library so gauge what's the theoretical max performance when creating Request & Response object pairs
  // const reqw = new Request("https://www.google.com", { method: "GET" });
  // const resp = new Response("hello World!", {
  //   status: 200,
  //   headers: { "Content-Type": "text/plain" },
  // });
  // const h = new Headers();
  // h.set("Content-Type", "text/plain");
  // if (resp.statusCode === 500) {
  //   console.log("kep in memory", reqw.url);
  //   h.set("Content-Type", "text/plain");
  // }
  res.writeHead(200, { "Content-Type": "text/plain" }).end("Hello World!");
}

function magicHandler() {
  return new Response("Hello World!", { status: 200, headers: { "Content-Type": "text/plain" } });
}
