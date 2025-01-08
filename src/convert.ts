import { convertHeaders, toNodeHeaders } from "./headers.ts";

import { ServerResponse } from "node:http";
import { sensitiveHeaders } from "node:http2";
import { Duplex, Readable } from "node:stream";
import { TLSSocket } from "node:tls";
import type { IncomingMessage } from "node:http";
import type { Http2ServerResponse, ServerHttp2Stream } from "node:http2";

export function convertToRequest(
  nodeApi: IncomingMessage | ServerHttp2Stream,
  headersIn: Headers | Record<string, string | string[]>,
): Request {
  const isTLS = Boolean(
    "socket" in nodeApi && nodeApi.socket instanceof TLSSocket,
  );
  const isH2 = nodeApi instanceof Duplex;
  const headers =
    headersIn instanceof Headers ? headersIn : convertHeaders(headersIn);
  const hostWithPort = isH2
    ? (headers.get("authority") ?? headers.get("host"))
    : nodeApi.headers.host;
  const scheme = String(
    isH2 ? headers.get("scheme") : isTLS ? "https" : "http",
  );
  const path = String(isH2 ? headers.get("path") : nodeApi.url);
  const method = String(isH2 ? headers.get("method") : nodeApi.method);
  const url = new URL(sanitizePath(path), `${scheme}://${hostWithPort}`);
  const bodyStream = nodeApi as unknown as BodyInit;
  const ctrl = new AbortController();
  const reqInit: RequestInit & { duplex: "half" } = {
    method,
    headers,
    body: method === "HEAD" || method === "GET" ? undefined : bodyStream,
    signal: ctrl.signal,
    referrer: headers.get("referrer") ?? undefined,
    duplex: "half", // The duplex field is now required for streaming bodies, but not yet reflected anywhere in docs or types. @see https://github.com/nodejs/node/issues/46221
  };
  nodeApi.once("aborted", () => ctrl.abort());
  return new Request(url, reqInit);
}

export async function sendResponse(
  output: ServerHttp2Stream | Http2ServerResponse | ServerResponse,
  resp: Response,
  h2sensitiveHeaders?: string[],
): Promise<void> {
  let h1writable: ServerResponse | null = null;
  let h2Stream: ServerHttp2Stream | null = null;

  if (!(resp instanceof Response)) {
    throw new TypeError(
      `Can send only a Response, but got "${(resp as any)?.constructor?.name}"`,
    );
  }

  if (output instanceof ServerResponse) h1writable = output;
  else if (output instanceof Duplex)
    h2Stream = output; // handle the ServerHttp2Stream argument
  else if ("stream" in output && output.stream instanceof Duplex)
    h2Stream = output.stream; // handle the Http2ServerResponse argument
  else
    throw new TypeError(
      `Output must be a ServerResponse, ServerHttp2Stream, or Http2ServerResponse, but got "${output?.constructor?.name}"`,
    );

  // console.log(`[sendResponse.${output.constructor.name}] inside for status`, resp.status);
  const alreadyResponded = Boolean(
    h2Stream?.headersSent ?? h1writable?.headersSent,
  );
  if (alreadyResponded) {
    // console.log(
    //   `[sendResponse ${output?.constructor?.name}]: Already responded in stream ${h2Stream?.id}!`,
    //   resp
    // );
    // return;
    throw new Error(
      "HTTP headers/response was already sent. Will not send this one.",
    );
  } // How would this work with EventSourcing?

  const sendHeaderObject = {
      ...Object.fromEntries(resp.headers.entries()),
      ...(h2Stream
        ? {
            ":status": Number(resp.status),
            [sensitiveHeaders as any]: h2sensitiveHeaders,
          }
        : undefined),
    },
    isOutputDead = Boolean(
      h2Stream
        ? (h2Stream.closed ?? h2Stream.destroyed)
        : h1writable &&
            (!h1writable.socket || h1writable.socket.readyState === "closed"),
    );

  /* c8 ignore next 4 */
  if (isOutputDead) {
    output.end();
    return;
  }

  // Send Headers
  if (h2Stream) {
    // TODO: not 100% sure this belongs at this level, or one level higher in the stack (e.g. in the server implementation)
    if ("connection" in sendHeaderObject) delete sendHeaderObject.connection; // NOT SUPPORTED in HTTP/2, but apps can accidentally set it
    // delete sendHeaderObject["content-length"]; // not required in HTTP/2, and can only cause problem
    h2Stream.respond(sendHeaderObject);
  } else if (h1writable) {
    /**
     * Caveat:
     * If writeHead is called and response.setHeader() has not been called, it will directly write the supplied header values onto the network channel without caching internally, and the response.getHeader() on the header will not yield the expected result.
     * If progressive population of headers is desired with potential future retrieval and modification, use response.setHeader() instead.
     */
    h1writable.writeHead(
      resp.status,
      resp.statusText,
      toNodeHeaders(resp.headers),
    );
    // h1writable.statusCode = resp.status;
    // h1writable.statusMessage = resp.statusText;
    // for (const [hdrKey, hdrValue] of resp.headers.entries()) h1writable.setHeader(hdrKey, hdrValue);
  }

  // resp.body *should* never happen, but we'll be extra defensive and check after flushing out headers
  /* c8 ignore next 4 */
  if (!resp.body) {
    output.end();
    return;
  }
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    Readable.fromWeb(resp.body as any)
      .pipe(h2Stream ?? h1writable ?? output)
      .on("error", reject)
      .on("end", resolve);
  });

  // The format below *should* work, but for some reason it throws `ERR_STREAM_PREMATURE_CLOSE` when using bombardier
  // return resp.body.pipeTo(Writable.toWeb(h2Stream || h1writable || output));
}

/**
 * Some paths are valid on the web, but not valid when passed to the `new URL` constructor.
 * For now, we'll just maintain a simple list of known issues and sanitize them but maybe there is a more reliable way to do at scale
 */
function sanitizePath(path: string) {
  if (path === "//") return "/";
  return path;
}
