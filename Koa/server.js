const Application = require("./application"); // 引入 Application 类
const fs = require("fs").promises; // 使用 promises API
const path = require("path");

const app = new Application();
const publicPath = path.join(__dirname, "public"); // 定义静态文件根目录

// --- 注册中间件 ---

// 中间件 0: 静态文件服务
app.use(async (ctx, next) => {
  // 只处理 GET 和 HEAD 请求
  if (ctx.method !== "GET" && ctx.method !== "HEAD") {
    return await next();
  }

  let filePath = path.join(publicPath, ctx.url);

  // 安全性：防止访问 publicPath 之外的文件
  // 通过规范化路径并检查它是否以 publicPath 开头
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(publicPath)) {
    // 尝试访问了不允许的路径
    ctx.res.statusCode = 403; // Forbidden
    ctx.body = "Forbidden";
    ctx.res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return; // 不调用 next
  }

  // 如果 URL 是 '/'，则默认提供 index.html
  if (ctx.url === "/") {
    filePath = path.join(publicPath, "index.html");
  }

  try {
    const stats = await fs.stat(filePath);

    // 确保请求的是文件而不是目录
    if (stats.isFile()) {
      ctx.res.statusCode = 200;
      // 根据文件扩展名设置 Content-Type (简化版)
      const ext = path.extname(filePath).toLowerCase();
      if (ext === ".html") {
        ctx.res.setHeader("Content-Type", "text/html; charset=utf-8");
      } else if (ext === ".css") {
        ctx.res.setHeader("Content-Type", "text/css; charset=utf-8");
      } else if (ext === ".js") {
        ctx.res.setHeader(
          "Content-Type",
          "application/javascript; charset=utf-8"
        );
      } // 可以添加更多类型...

      // 读取文件内容并设置为响应体
      ctx.body = await fs.readFile(filePath);
      // 成功处理静态文件，不再调用 next()
      console.log(`Serving static file: ${filePath}`);
      return;
    }
  } catch (err) {
    // 如果文件不存在 (err.code === 'ENOENT') 或其他错误，
    // 则忽略错误，让请求流向下一个中间件
    if (err.code !== "ENOENT") {
      console.error(`Error reading static file ${filePath}:`, err);
      // 对于其他读取错误，可能返回 500
      ctx.res.statusCode = 500;
      ctx.body = "Internal Server Error while reading file";
      ctx.res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return;
    }
    // 文件不存在，继续执行下一个中间件
  }

  // 如果不是静态文件请求或文件未找到，则调用下一个中间件
  await next();
});

// 中间件 1: 记录请求时间
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log(`--> MW1 Start ${ctx.method} ${ctx.url}`);
  await next(); // 调用下一个中间件
  // 注意：移除了重复的 await next(); 调用，因为它会导致错误
  const ms = Date.now() - start;
  console.log(`<-- MW1 End (${ms}ms)`);
  // 避免覆盖静态文件中间件可能设置的 Content-Type
  if (!ctx.res.getHeader("Content-Type")) {
    // 也许这里不需要默认设置 Content-Type 了，除非有特定逻辑
  }
  ctx.res.setHeader("X-Response-Time", `${ms}ms`);
});

// 中间件 2: 模拟异步操作
app.use(async (ctx, next) => {
  console.log(` --> MW2 Start`);
  // 模拟一个异步数据库查询或 API 调用
  await new Promise((resolve) => setTimeout(resolve, 100));
  console.log(` <-- MW2 Async Done`);
  await next(); // 调用下一个中间件
  console.log(`<-- MW2 End`);
});

// 中间件 3: 设置响应体
app.use(async (ctx, next) => {
  console.log(` --> MW3 Start`);
  // 检查是否是根路径
  if (ctx.url === "/") {
    ctx.body = "Hello from MyKoa!";
    ctx.res.statusCode = 200; // 明确设置成功状态码
  } else if (ctx.url === "/json") {
    ctx.body = { message: "This is JSON" };
    ctx.res.statusCode = 200;
  }
  // 对于其他路径，保持默认的 404 Not Found

  console.log(`<-- MW3 End`);
  // 这里不再需要调用 next()，因为它是最后一个中间件
});

// --- 启动服务器 ---
const hostname = "127.0.0.1";
const port = 3000;

app.listen(port, hostname, () => {
  console.log(`MyKoa server running at http://${hostname}:${port}/`);
  console.log(`Serving static files from: ${publicPath}`);
});
