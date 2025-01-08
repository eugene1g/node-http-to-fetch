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
