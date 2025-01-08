import { connect } from "node:http2";
import type { ClientHttp2Session } from "node:http2";

export function h2client(baseUrl: URL) {
  let session: ClientHttp2Session | null = null;

  return {
    async connect() {
      return new Promise<void>((resolv, reject) => {
        connect(baseUrl, { rejectUnauthorized: false })
          .on("error", reject)
          .on("connect", (newSess, _newSocket) => {
            session = newSess;
            resolv();
          });
      });
    },

    async get(url: string): Promise<Response> {
      return new Promise((resolv, reject) => {
        if (!session) {
          reject();
          return;
        }
        let headersBack = new Headers();
        let data = "";

        const req = session
          .request({
            ":path": new URL(url, baseUrl).pathname,
            ":method": "GET",
          })
          .setEncoding("utf8")
          .on("headers", (headers, _flags) => {
            for (const name in headers)
              headersBack.set(name, headers[name] as string);
          })
          .on("data", (chunk) => (data += chunk))
          .on("end", () => {
            const res = new Response(data, { headers: headersBack });
            resolv(res);
          })
          .on("error", reject)
          .end();
      });
    },

    async disconnect() {
      if (!session) return;
      return new Promise<void>((resolv) => session?.close(resolv));
    },
  };
}
