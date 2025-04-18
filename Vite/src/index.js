import { createServer } from "./server/createServer.js";

async function start() {
  const port = 3000;
  const server = await createServer({ root: process.cwd(), port });
}

start();
