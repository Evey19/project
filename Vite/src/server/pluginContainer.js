import fs from "fs/promises";
import path from "path";
import { htmlPlugin } from "./plugins/htmlPlugin.js";
import { bareImportPlugin } from "./plugins/bareImportPlugin.js";

export class PluginContainer {
  constructor(config) {
    this.config = config;
    // 按顺序加载插件
    this.plugins = [htmlPlugin(), bareImportPlugin(config.root)];
  }

  // 启动生命周期钩子
  async buildStart() {
    for (const p of this.plugins) {
      if (p.buildStart) await p.buildStart(this.config);
    }
  }

  // 处理 index.html，按插件链调用 transformIndexHtml
  async transformIndexHtml(url) {
    const filePath = path.join(this.config.root, url);
    let code = await fs.readFile(filePath, "utf-8");
    for (const p of this.plugins) {
      if (p.transformIndexHtml) {
        code = await p.transformIndexHtml(url, code);
      }
    }
    return code;
  }

  // resolveId：将请求路径映射到磁盘真实文件或虚拟模块
  async resolveId(source) {
    for (const p of this.plugins) {
      if (p.resolveId) {
        const res = await p.resolveId(source, this.config);
        if (res) {
          return typeof res === "string" ? { id: res } : res;
        }
      }
    }
    // 默认把 /xxx 映射到项目根目录
    if (source.startsWith("/")) {
      return { id: path.join(this.config.root, source) };
    }
    return null;
  }

  // load：读取模块内容或返回虚拟模块
  async load(id) {
    for (const p of this.plugins) {
      if (p.load) {
        const res = await p.load(id, this.config);
        if (res != null) return res;
      }
    }
    // 默认从磁盘读
    return fs.readFile(id, "utf-8");
  }

  // transform：对源码做最终转换（如裸导入重写、JSX/TS 处理等）
  async transform(code, id) {
    let cur = code;
    for (const p of this.plugins) {
      if (p.transform) {
        const result = await p.transform(cur, id, this.config);
        if (result && result.code) {
          cur = result.code;
        }
      }
    }
    return { code: cur };
  }
}
