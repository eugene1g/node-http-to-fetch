import { testServers } from "./servers.ts";
import { runReq } from "./utils.ts";

import { test } from "node:test";
import { match, ok } from "node:assert/strict";

await test("Can get network details for the request", async () => {
  const testServer = testServers.h2();
  const url = new URL("/", await testServer.getUrl());
  const res = await runReq(url);

  match(String(res.json?.net?.ipFamily), /IPv[46]/);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  ok(Object.hasOwn(res.json?.net, "localAddress"));
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  ok(Object.hasOwn(res.json?.net, "remoteAddress"));
  await testServer.stop();
});
