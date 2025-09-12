export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });

  // Flush hack: send et "ping" med en gang
  res.write(`: ping\n\n`);
  res.write(`event: debug\ndata: {"msg":"handler_started","t":${Date.now()}}\n\n`);

  let i = 0;
  const interval = setInterval(() => {
    i++;
    res.write(`data: {"tick":${i},"t":${Date.now()}}\n\n`);

    if (i >= 5) {
      clearInterval(interval);
      res.write(`event: end\ndata: {}\n\n`);
      res.end();
    }
  }, 1000);
}
