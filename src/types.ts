import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  Http2ServerRequest,
  Http2ServerResponse,
  IncomingHttpHeaders,
  ServerHttp2Stream,
} from "node:http2";

/**
 * The signature means the same event handler can be used for .on("request") events on http/https/http2 servers, for .on("stream") events on http2 servers
 */
type HandlerOnRequestHttp1 = (
  req: IncomingMessage,
  res: ServerResponse,
) => void;
type HandlerOnRequestHttp2 = (
  req: Http2ServerRequest,
  res: Http2ServerResponse,
) => void;
type HandlerOnStreamHttp2 = (
  stream: ServerHttp2Stream,
  headers: IncomingHttpHeaders,
) => void;
export type HandlerUniversal = HandlerOnRequestHttp1 &
  HandlerOnRequestHttp2 &
  HandlerOnStreamHttp2;

type MaybeResponse = Response | void | Promise<Response | void>;
export type ErrorHandler = (
  error: Error,
  httpCtx: { net: NetInfo },
) => MaybeResponse;

// A regular request/response pair created by http/https servers, and by http2 server in compatibility mode handing HTTP1 requests
export type Http1Ctx = {
  api: "http1";
  nodeReq: IncomingMessage;
  nodeRes: ServerResponse;
  net: NetInfo;
};

// Node's http2 server, used in the native mode (handling the "stream" event)
export type Http2Ctx = {
  api: "h2";
  nodeStream: ServerHttp2Stream;
  net: NetInfo;
};
export type HttpCtx = Http1Ctx | Http2Ctx;
export type RequestHandler = (
  req: Request,
  httpCtx: { net: NetInfo },
) => MaybeResponse;

export type NetInfo = {
  remoteAddress: string;
  ipFamily: "IPv4" | "IPv6";
  tls: null | {
    proto: "TLSv1.1" | "TLSv1.2" | "TLSv1.3"; // @see https://nodejs.org/api/tls.html#tlssocketgetprotocol
    cipher: string; // IETF name, as returned by .getCipher().standardName @see https://nodejs.org/api/tls.html#tlssocketgetcipher
  };
  localAddress: string | null;
  localPort: number | null;
};
