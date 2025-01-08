import { testServers } from "./servers.ts";
import { runReq } from "./utils.ts";

import { test } from "node:test";
import { deepEqual, match } from "node:assert/strict";

await test("URL and method", async () => {
  const testServer = testServers.h2();
  const url = new URL("/app/home", await testServer.getUrl());
  const res = await runReq(url, { method: "POST" });
  match(String(res.json.url), /\/app\/home/);
  deepEqual(res.json.method, "POST");
  await testServer.stop();
});

await test("Query params", async () => {
  const testServer = testServers.h2();
  const url = new URL("/someq?one=1&two=2", await testServer.getUrl());
  const res = await runReq(url);
  deepEqual(res.json.qs.one, "1");
  deepEqual(res.json.qs.two, "2");
  await testServer.stop();
});

await test("Headers", async () => {
  const testServer = testServers.h2();
  const url = new URL("/getheaders", await testServer.getUrl());
  const res = await runReq(url, { headers: { "x-foo": "bar" } });
  deepEqual(res.json.scheme, "https");
  deepEqual(res.json.headers["x-foo"], "bar");
  await testServer.stop();
});

await test("Body payload", async () => {
  const testServer = testServers.h2();
  const url = new URL("/withpayload", await testServer.getUrl());
  const res = await runReq(url, { method: "POST", body: "hello world" });
  deepEqual(res.json.postBody, "hello world");
  await testServer.stop();
});
