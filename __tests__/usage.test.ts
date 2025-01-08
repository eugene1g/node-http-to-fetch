import { testServers } from "./servers.ts";
import { runReq } from "./utils.ts";
import { installRequestLoop } from "../src/install.ts";

import { test } from "node:test";
import assert from "node:assert/strict";

await test("Can have multiple such handlers, for middleware purposes", async () => {
  const serv = testServers.h2();
  let customLoopGotCalled = false;
  installRequestLoop(serv._instance, async function definedInTest() {
    customLoopGotCalled = true;
  });

  const url = new URL("/app/emptylistener", await serv.getUrl());
  const res = await runReq(url);
  await serv.stop();

  assert.ok(customLoopGotCalled);
  assert.equal(res.json.method, "GET");
});

await test("With multiple handlers, the first Response to return, but the rest can be executed", async () => {
  const serv = testServers.h2();
  const url = new URL("/app/superquick", await serv.getUrl());
  let customLoopGotCalled = false;
  installRequestLoop(serv._instance, async function anotherResponseInTest() {
    customLoopGotCalled = true;
    return new Response("Superquick response", { status: 201 });
  });
  const res = await runReq(url);
  await serv.stop();
  assert.ok(customLoopGotCalled);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body, "Superquick response");
});
