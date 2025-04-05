const http = require("http");
const compose = require("./compose"); // 引入 compose 模块

class Application {
  constructor() {
    this.middleware = []; // 中间件栈
  }

  // 注册中间件
  use(fn) {
    if (typeof fn !== "function")
      throw new TypeError("middleware must be a function!");
    this.middleware.push(fn);
    return this; // 支持链式调用
  }

  // 创建上下文对象
  createContext(req, res) {
    const context = {};
    context.req = req;
    context.res = res;
    context.url = req.url;
    context.method = req.method;
    context.body = "Not Found"; // 默认响应体
    res.statusCode = 404; // 默认状态码
    // 你可以在这里添加更多 Koa ctx 上的常用属性或方法
    return context;
  }

  // 处理请求的核心回调
  handleRequest(ctx, fnMiddleware) {
    const handleResponse = () => {
      const body = ctx.body;
      const res = ctx.res;

      // 如果没有响应体内容，则返回 Not Found 或者根据状态码决定
      if (null == body) {
        if (ctx.req.httpVersionMajor >= 2 && res.statusCode === 404) {
          ctx.body = "Not Found"; // 保持原有逻辑
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        } else {
          // 对于HEAD请求或无内容状态码，不需要发送body
          return res.end();
        }
      }

      // 根据ctx.body的类型设置Content-Type并发送响应
      if (Buffer.isBuffer(body)) {
        // Content-Type 应该由静态文件中间件设置
        return res.end(body);
      } else if (typeof body === "string") {
        if (!res.getHeader("Content-Type")) {
          // 检查是否已设置 Content-Type
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        return res.end(body);
      } else if (typeof body === "object") {
        if (!res.getHeader("Content-Type")) {
          // 检查是否已设置 Content-Type
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        }
        return res.end(JSON.stringify(body)); // 对象转 JSON 字符串
      }
    };

    const onError = (err) => {
      console.error("Middleware Error:", err);
      // 避免重复设置 header
      if (!ctx.res.headersSent) {
        ctx.res.statusCode = 500;
        ctx.res.setHeader("Content-Type", "text/plain");
        ctx.res.end("Internal Server Error");
      }
    };

    // 执行中间件组合函数
    // 使用 .call(this, ctx) 确保 fnMiddleware 内部的 this 指向正确 (虽然在此例中影响不大)
    return fnMiddleware(ctx).then(handleResponse).catch(onError);
  }

  // 启动服务器
  listen(...args) {
    // 组合所有注册的中间件
    const fnMiddleware = compose(this.middleware);

    const server = http.createServer((req, res) => {
      // 为每个请求创建独立的上下文对象
      const ctx = this.createContext(req, res);
      // 处理请求
      this.handleRequest(ctx, fnMiddleware);
    });

    return server.listen(...args); // 将 listen 参数传给 http.server.listen
  }
}

module.exports = Application; // 导出 Application 类
