import { WebSocketServer } from "ws";
import chokidar from "chokidar";

export function setupWebSocket(server, pluginContainer) {
  const wss = new WebSocketServer({ server });
  const clients = new Set();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
  });

  // 监听文件变化，广播刷新消息
  chokidar
    .watch(pluginContainer.config.root, {
      ignored: /node_modules/,
    })
    .on("change", (file) => {
      for (const ws of clients) {
        ws.send(JSON.stringify({ type: "refresh", path: file }));
      }
    });

  /**
   * 当浏览器访问 http://your-server/@vite/client 时（例如通过 <script src="/@vite/client"></script> 引入），服务器会触发这段代码。
   * 动态生成一段JavaScript代码建立WebSocket连接：new WebSocket(\ws://${location.host}`) 浏览器会连接到与当前页面同主机
   * 如果消息类型是 refresh，强制刷新页面。
   */

  server.on("request", (req, res) => {
    if (req.url === "/@vite/client") {
      const clientCode = `
        const socket = new WebSocket(\`ws://\${location.host}\`);
        socket.addEventListener('message', ({ data }) => {
          const msg = JSON.parse(data);
          if (msg.type === 'refresh') {
            console.log('[mini-vite] 文件更新，刷新页面。');
            location.reload();
          }
        });
      `;
      res.setHeader("Content-Type", "application/javascript");
      res.end(clientCode);
    }
  });
}
