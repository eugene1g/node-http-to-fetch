import { testServers } from "./servers.ts";
import { runReq } from "./utils.ts";

import { test } from "node:test";
import { deepEqual } from "node:assert/strict";

await test("Empty response", async () => {
  const testServer = testServers.h2();
  const url = new URL("/emptyResponse", await testServer.getUrl());
  const res = await runReq(url);
  deepEqual(res.statusCode, 202);
  await testServer.stop();
});

await test("HTTP2", async () => {
  const testServer = testServers.h2();
  const url = new URL("/forcehttp2", await testServer.getUrl());
  const res = await runReq(url, { http2: true });
  deepEqual(res.statusCode, 200);
  await testServer.stop();
});
