// Fixture dev server: honors env PORT and prints its URL the way vite does on
// win32 — with ANSI codes INSIDE the URL — so the integration test exercises
// the real strip-then-match ready-detection pipeline.
const http = require("node:http");

const port = Number(process.env.PORT || 5173);
const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("hello from fixture");
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `  \x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m${port}\x1b[22m/\x1b[39m`,
  );
});
