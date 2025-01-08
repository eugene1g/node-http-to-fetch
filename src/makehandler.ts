import { convertToRequest, sendResponse } from "./convert.ts";
import { convertHeaders } from "./headers.ts";
import { defaultErrorHandler, getSocketInfo } from "./utils.ts";
import type {
  ErrorHandler,
  HandlerUniversal,
  HttpCtx,
  RequestHandler,
} from "./types.ts";

import { IncomingMessage } from "node:http";
import { Http2ServerRequest, sensitiveHeaders } from "node:http2";
import { Duplex } from "node:stream";
import type { ServerResponse } from "node:http";
import type { IncomingHttpHeaders, ServerHttp2Stream } from "node:http2";

/**
 * This function generates an event handler for .on('request') and .on('stream') events of http/https/http2 servers.
 * It takes the main RequestHandler which is the core running loop of the application, and deals with Requests and Responses
 */
export function createEventHandler(
  mainLoop: RequestHandler,
  errorHandler: ErrorHandler = defaultErrorHandler,
): HandlerUniversal {
  let numWarningsAboutMissingResponses = 0;
  return function nodeHttpServerEventHandler(arg1, arg2): void {
    // console.log(`[event for '${mainLoop.name}']`, arg1.constructor.name, arg2.constructor?.name);
    /**
     * This event handler can be installed on the http2 server in the .on("request") event. However, all HTTP2 requests are handled in the .on("stream") event, so we ignore them here and handle only HTTP1 requests.
     * BugAlert: The main expectation for running an HTTP2 server is that the user has this handler installed to the "stream" event, and that handles all HTTP2 requests.
     * If the server is configured with {allowHTTP1:true}, HTTP1 connection do no go through the on('stream') event, and go to .on('request').
     * However, all HTTP2 connection also trigger on('request'), so this handler would be called twice, but we ignore all HTTP2 connection here because they would have been handled via the on("stream") event
     */
    if (arg1 instanceof Http2ServerRequest) {
      // console.log(
      //   `[event for '${mainLoop.name}'] skip any processing`,
      //   arg1.constructor.name,
      //   arg2.constructor?.name
      // );
      return;
    }

    let triggerCtx: HttpCtx;
    let request: Request, inHeaders;
    let sendOutputTo: ServerResponse | ServerHttp2Stream;
    let h2SensHeaders: string[] | undefined = undefined;

    if (arg1 instanceof IncomingMessage) {
      /**
       * This is triggered as part of the .on("request") event in three cases:
       * 1. "node:http" server, created with createServer();
       * 2. "node:https" server
       * 3. "node:http2" server, created with createSecureServer() and has {allowHTTP1: true} configured, accepting calls on the on('request') event in in the Compatibility mode
       * This last point is important. All HTTP1 requests end up in this path, even if accepted by "node:http2" server
       */
      const netInfo = getSocketInfo(arg1.socket);
      triggerCtx = {
        api: "http1",
        nodeReq: arg1,
        nodeRes: arg2 as ServerResponse,
        net: netInfo,
      };
      inHeaders = convertHeaders(triggerCtx.nodeReq.headers);
      request = convertToRequest(triggerCtx.nodeReq, inHeaders);
      sendOutputTo = triggerCtx.nodeRes;
    } else if (arg1 instanceof Duplex) {
      // The socket has been terminated, nothing for us to do here
      if (!arg1.session?.socket) return;

      /**
       * This is triggered as part of the .on("stream") event in one case:
       * 1. "node:http2" server, created with createSecureServer(), getting an HTTP2 request
       */
      const netInfo = getSocketInfo(arg1.session.socket);
      triggerCtx = { api: "h2", nodeStream: arg1, net: netInfo };
      inHeaders = convertHeaders(arg2 as IncomingHttpHeaders);
      request = convertToRequest(triggerCtx.nodeStream, inHeaders);
      sendOutputTo = triggerCtx.nodeStream;
      h2SensHeaders = (arg2 as any)[sensitiveHeaders] as string[];
      /* c8 ignore next 1 */
    } else
      throw new TypeError(
        `[Server Handler]: Don't know how to handle this request type`,
      );

    // Wrap everything into a Promise.resolve, so that we can catch any errors in the handler even if it's sync. If it's async, this is a no-op anyway
    void Promise.resolve(mainLoop(request, triggerCtx))
      .catch(async (error) => {
        const passErr =
          error instanceof Error
            ? error
            : new Error(`Request listener failed`, { cause: error });
        // this will return the error response to the client
        return errorHandler(passErr, triggerCtx);
      })
      .then(async (response) => {
        if (request.signal.aborted) {
          // console.log(`[event for '${mainLoop.name}']: Request has been cancelled, returning`);
          return;
        }
        if (!response) {
          if (numWarningsAboutMissingResponses < 10) {
            console.warn(
              `[HTTP Handler]: Did not get a Response object from the handler '${
                mainLoop.name || "anonymous"
              }'. This is likely a bug - a handler _should_ return a Response object. Perhaps you are missing a return statement? This behavior might be OK only for middleware handlers like logging.`,
            );
            numWarningsAboutMissingResponses++;
          }
          return;
        }
        // console.log(`[event for '${mainLoop.name}']: Will call sendResponse`, response.status);
        return sendResponse(sendOutputTo, response, h2SensHeaders);
      })
      .catch((error) => console.error(error)); // Would be strange to have an Exception here - maybe something failed while sending the response over the wire. Not quite sure how to handle it, but sure that we shouldn't crash the server.
  };
}
