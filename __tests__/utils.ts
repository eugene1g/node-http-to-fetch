import { got } from "got";
import { Readable } from "node:stream";
import type { Method, Options } from "got";

export async function runReq(
  url: URL,
  ops?: {
    ipVersion?: 4 | 6 | undefined; // force a specific dns resolution IP, or use the OS default
    http2?: boolean;
    method?: Method;
    body?: string;
    agent?: Options["agent"];
    headers?: Record<string, string>;
  },
) {
  const gotReq = await got(url, {
    http2: typeof ops?.http2 === "boolean" ? ops.http2 : true,
    throwHttpErrors: false,
    https: { rejectUnauthorized: false },
    method: ops?.method ?? "GET",
    body: ops?.body,
    headers: ops?.headers ?? {},
    ...(ops?.ipVersion
      ? {
          dnsLookupIpVersion: ops?.ipVersion,
        }
      : {}),
    ...ops,
  });
  let jsonBody = null;
  try {
    jsonBody = JSON.parse(gotReq.body) as Record<string, any>;
  } catch {}
  return {
    statusCode: gotReq.statusCode,
    headers: gotReq.headers,
    body: gotReq.body,
    json: jsonBody ?? {},
  };
}

export async function consumeRequestBody(request: Request): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let chunks: Buffer[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    Readable.fromWeb(request.body as any)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      .on("data", (chunk) => chunks.push(Buffer.from(chunk)))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });
}
