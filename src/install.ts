import { createEventHandler } from "./makehandler.ts";
import type { ErrorHandler, RequestHandler } from "./types.ts";

import { Server as TLSServer } from "node:tls";
import type { Server as Http1VanillaServer } from "node:http";
import type { Http2SecureServer } from "node:http2";
import type { Server as Http1SecureServer } from "node:https";

/**
 * This helper utility will install all event listeners on the server, and return a function to uninstall them.
 */
export function installRequestLoop(
  onServer: Http1VanillaServer | Http1SecureServer | Http2SecureServer,
  mainLoop: RequestHandler,
  errorHandler?: ErrorHandler,
): () => void {
  const handler = createEventHandler(mainLoop, errorHandler);
  /**
   * Handle all HTTP1 requests.
   * Technically, the server could be HTTP2-only (i.e., configured with { allowHTTP1: false}), but there is no reliable way to check this after the initiation, and most sane people run with both HTTP1+HTTP2 enabled
   */
  onServer.addListener("request", handler); // Handles all HTTP1 requests

  const isHttp2Server =
    onServer instanceof TLSServer && onServer.eventNames().includes("stream");
  if (isHttp2Server) onServer.addListener("stream", handler);

  return function uninstall() {
    onServer.removeListener("request", handler);
    if (isHttp2Server) onServer.removeListener("stream", handler);
  };
}
