import type { NetInfo } from "./types.ts";

import { TLSSocket } from "node:tls";
import type { Socket } from "node:net";

const isTestRunTime = globalThis?.process?.env?.NODE_ENV === "test";
export function defaultErrorHandler(
  error: Error,
  httpCtx: { net: NetInfo },
): Response {
  /* c8 ignore next 3 */
  if (!isTestRunTime) {
    console.error(
      `Server Listener failure for ${httpCtx.net.remoteAddress}`,
      error,
    );
  }
  const usrMsg = "Sorry, an unknown error occurred. Please try again later";
  return new Response(usrMsg, {
    status: 500,
    headers: new Headers({
      "content-type": "text/plain",
      "content-length": usrMsg.length.toString(),
      connection: "close",
    }),
  });
}

export function getSocketInfo(socket: Socket | TLSSocket): NetInfo {
  const isTLS = socket instanceof TLSSocket;
  return {
    remoteAddress: `${socket.remoteAddress}`,
    ipFamily: String(socket.localFamily) as NetInfo["ipFamily"],
    tls: isTLS
      ? {
          proto: socket.getProtocol() as "TLSv1.1" | "TLSv1.2" | "TLSv1.3",
          cipher: String(socket.getCipher()?.standardName),
        }
      : null,
    localAddress: socket.localAddress ? `${socket.localAddress}` : null,
    localPort: socket.localPort ? Number(socket.localPort) : null,
  };
}
