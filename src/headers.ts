/**
 * Duplicates in raw headers are handled in the following ways, depending on the header name:
 * Duplicates of age, authorization, content-length, content-type, etag, expires, from, host, if-modified-since, if-unmodified-since, last-modified, location, max-forwards, proxy-authorization, referer, retry-after, server, or user-agent are discarded.
 * set-cookie is always an array. Duplicates are added to the array.
 * For duplicate cookie headers, the values are joined together with ; .
 */
import type { IncomingHttpHeaders, OutgoingHttpHeaders } from "node:http2";

const discardDuplicateHeaders = [
  // This behavior and the list is copied from https://nodejs.org/api/http.html#messageheaders
  "age",
  // "authorization", @see https://github.com/nodejs/node/issues/45699
  "content-length",
  "content-type",
  "etag",
  "expires",
  "from",
  "host",
  "if-modified-since",
  "if-unmodified-since",
  "last-modified",
  "location",
  "max-forwards",
  "proxy-authorization",
  "referer",
  "retry-after",
  "server",
  "user-agent",

  // Addition list of headers for HTTP2 as per https://nodejs.org/api/http2.html#headers-object
  "status",
  "method",
  "authority",
  "scheme",
  "path",
  "protocol",
  // "age", dupe
  // "authorization", dupe
  "access-control-allow-credentials",
  "access-control-max-age",
  "access-control-request-method",
  "content-encoding",
  "content-language",
  // "content-length", dupe
  "content-location",
  "content-md5",
  "content-range",
  // "content-type", dupe
  "date",
  "dnt",
  // "etag", dupe
  // "expires", dupe
  // "from", dupe
  // "host", dupe
  "if-match",
  // "if-modified-since", dupe
  "if-none-match",
  "if-range",
  // "if-unmodified-since", dupe
  // "last-modified", dupe
  // "location", dupe
  // "max-forwards", dupe
  // "proxy-authorization", dupe
  "range",
  // "referer", dupe
  // "retry-after", dupe
  "tk",
  "upgrade-insecure-requests",
  // "user-agent", dupe
  "x-content-type-options",
];

// HTTP2 handling @see https://nodejs.org/api/http2.html#headers-object
// Use an intermediate Headers set so it normalizes all names for us
const headersToDiscardDupes = new Headers();
for (const headerName of discardDuplicateHeaders)
  headersToDiscardDupes.set(headerName, "1");

/**
 * Normalizes incoming headers into a standard Headers object
 * For HTTP1, headers must be provided from the msg.headersDistinct method @see https://nodejs.org/api/http.html#messageheadersdistinct
 * For HTTP2, headers must be provided from the stream->headers parameter
 */
export function convertHeaders(
  hash: Record<string, string[] | string> | IncomingHttpHeaders,
): Headers {
  let headers = new Headers();
  for (const headerName in hash) {
    const cleanName = headerName.startsWith(":")
      ? headerName.slice(1)
      : headerName;
    /* c8 ignore next */
    if (headers.has(cleanName) && headersToDiscardDupes.has(cleanName))
      continue;
    const values = hash[headerName];
    const valuesAsArray = Array.isArray(values) ? values : [values];
    for (const oneValue of valuesAsArray)
      if (oneValue !== undefined) headers.append(cleanName, oneValue);
  }
  return headers;
}

/**
 * This function provides a transparent proxy so we can optimize the way we send response to HTTP1 clients
 */
export function toNodeHeaders(headers: Headers): OutgoingHttpHeaders {
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        return headers.get(prop);
      },
      set(_target, prop: string, value: string) {
        headers.set(prop, value);
        return true;
      },
      has(_target, prop: string) {
        return headers.has(prop);
      },
      deleteProperty(_target, prop: string) {
        headers.delete(prop);
        return true;
      },
      ownKeys() {
        const keys: string[] = [];
        for (const [key] of headers.entries()) keys.push(key);
        return keys;
      },
      getOwnPropertyDescriptor() {
        return { enumerable: true, configurable: true };
      },
    },
  );
}
