import connect from "connect";
import sirv from "sirv";
import http from "http";
import { PluginContainer } from "./pluginContainer.js";
import { setupWebSocket } from "./ws.js";

export async function createServer(options) {
  const { root, port } = options;
  // 1. 初始化插件容器
  const container = new PluginContainer({ root, port });
  await container.buildStart();

  // 2. 构造 Connect 应用
  const app = connect();

  // 2.1 静态资源（HTML/CSS/图片等）
  app.use(sirv(root, { dev: true }));

  // 2.2 HTML 注入 HMR 客户端
  app.use(async (req, res, next) => {
    if (!req.url.endsWith(".html")) return next();
    try {
      const html = await container.transformIndexHtml(req.url);
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } catch (e) {
      next(e);
    }
  });

  // 2.3 模块请求（.js / 裸模块 @modules）
  app.use(async (req, res, next) => {
    if (!isModuleRequest(req.url)) return next();
    try {
      const { id } = await container.resolveId(req.url);
      let code = await container.load(id);
      const result = await container.transform(code, id);
      res.setHeader("Content-Type", "application/javascript");
      res.end(result.code);
    } catch (e) {
      next(e);
    }
  });

  // 3. 创建 HTTP Server 并挂载 HMR WebSocket
  const server = http.createServer(app);
  setupWebSocket(server, container);

  // 4. 监听端口
  return server.listen(port, () => {
    console.log(`> mini-vite dev server running at http://localhost:${port}`);
  });
}

// 简单判断是否是 JS 模块请求
function isModuleRequest(url) {
  return url.endsWith(".js") || url.startsWith("/@modules/");
}
