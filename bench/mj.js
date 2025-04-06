import { createServer } from "node:http";
import { createRequestListener } from "@mjackson/node-fetch-server";
import { createListener } from "../dist/main.js";

createServer(createRequestListener(genResponse)).listen(4501);
createServer(createListener(genResponse)).listen(4502);

function genResponse() {
  return new Response("hello", { headers: { "Content-Type": "text/html" } });
}
