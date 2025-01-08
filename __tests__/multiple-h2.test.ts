import { h2client } from "./h2client.ts";
import { testServers } from "./servers.ts";

import { test } from "node:test";
import assert from "node:assert/strict";

await test("Handles multiple requests over a single HTTP2 connection", async () => {
  const serv = testServers.h2();
  // console.log("did init");
  const baseUrl = await serv.getUrl();
  // console.log("got url");
  const sharedConn = h2client(baseUrl);
  // console.log("got client");
  await sharedConn.connect();
  // console.log("did connect()");
  const r1 = await sharedConn.get("/api/call1");
  // console.log("did get1()");
  const r2 = await sharedConn.get("/api/call2");
  // console.log("did get2()");
  const r3 = await sharedConn.get("/api/call3");
  // console.log("did get3()");
  await sharedConn.disconnect();
  // console.log("did disconnect()");
  await serv.stop(); // TODO: IN TIMED OUT TESTS, THIS STEP NEVER ENDS!!
  assert.match(await r1.text(), /call1/);
  assert.match(await r2.text(), /call2/);
  assert.match(await r3.text(), /call3/);
  assert.equal(serv.hadConnections, 1);
});
