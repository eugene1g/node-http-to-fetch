[![](https://github.com/eugene1g/node-http-to-fetch/actions/workflows/validate.yml/badge.svg)](https://github.com/eugene1g/node-http-to-fetch/actions/workflows/validate.yml)


# Node <-> WHATWG Adapter 
A bridge to work with Node.js Servers (HTTP1/HTTPS/HTTP2) using the `Request` + `Response` paradigm of the WHATWG, instead of streams.

# Example


```ts

import { createListener } from "./main.ts";
import { createServer } from "node:http";

const s = createServer(
  createListener(async (req, { net }) => {
    return new Response(
      `Hello ${req.headers.get("user-agent")} from  ${net.remoteAddress}`,
    );
  }),
);
s.listen(8989);


```


# Gotchas
* Must use Node.js `^18.13.0 || ^19.3.0` because of important changes [ref1](https://github.com/nodejs/node/pull/45672), [ref2](https://github.com/nodejs/node/pull/45642), [ref3](https://github.com/nodejs/node/issues/42694), [ref4](https://github.com/nodejs/node/issues/44188)
* In case there are multiple listeners installed, the first one to return a `Response` will "win" - that `Response` will be sent to the user. Note that this does not mean the first handler _mounted_ or the first one to be _called_ - some handlers can be slower than others. The first one to finish executing and returning a Response will win, regardless of when it was mounted.

## TODOs
- [ ] Tests: raw HTTP request text (not via a client)
- [ ] Make `net` into lazy so we don't call `.address()` on every request as it probably won't be used much.
- [ ] Maybe: expose `.rawWrite` to flush information to the client? (for e.g., Early Hints)
- [ ] `api` value of `http1` vs `h2`. ALPN standard [says](https://www.iana.org/assignments/tls-extensiontype-values/tls-extensiontype-values.xhtml#alpn-protocol-ids) it should be `http/1.1` but ugh that's too long. Maybe `h1` is enough? Consistent, but nobody know what it means.


# HTTP2
* HTTP/2 assumes the persistent connection is used. Therefore, no `Connection: keep-alive` is required.
* `Stream`: the lifecycle of a stream is equivalent to a request-response message in HTTP/1.x.
* A new id is assigned until it reaches 2³¹. When the last id is used, the browser sends a GOAWAY frame to initialize a new TCP connection, and the stream ID is reset.
* The stream ID is assigned in increasing order. The odd number is for the browser, and the even number is for the server. Therefore, you see the odd number more often.
* The stream-0 is reserved for flow-control. It cannot be closed.

# References
* [HTTP/2 and How it Works](https://cabulous.medium.com/http-2-and-how-it-works-9f645458e4b2)
* [whatwg-node adapter](https://github.com/ardatan/whatwg-node/blob/master/packages/server/src/createServerAdapter.ts)
* [Remix Run adapter](https://github.com/remix-run/remix/tree/main/packages/remix-node) (also has a stream pump, if required)
* https://github.com/nodejs/node/issues/42529
