import { testServers } from "./servers.ts";
import { runReq } from "./utils.ts";

import { test } from "node:test";
import { deepEqual } from "node:assert/strict";

/**
 * BugAlert:
 * For some reason, if the tests has both http1 and http2 requests, that test can timeout
 */
await test("HTTP1", async () => {
  const testServer = testServers.h2();
  const url = new URL("/forcehttp1", await testServer.getUrl());
  const res = await runReq(url, { http2: true });
  deepEqual(res.statusCode, 200);
  await testServer.stop();
});
