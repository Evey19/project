import { createServer } from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = process.cwd();

const mimeTypes = {
  html: "text/html",
  js: "application/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
};

// 将裸模块导入重写为/@modules/xxx，原因在于浏览器原生ESM不支持
function rewriteImports(code) {
  return code.replace(
    /(?:import|export)\s+([\s\S]+?)\s+from\s+['"]([^'".][^'"]*)['"]/g,
    (full, imports, spec) => {
      if (spec.startsWith(".") || spec.startsWith("/")) {
        return full;
      }
      return full.replace(spec, `/@modules/${spec}`);
    }
  );
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === "/") {
    pathname = "/index.html";
  }

  try {
    if (pathname.startsWith("/@modules/")) {
      const modulePath = pathname.replace("/@modules/", "");
      const [moduleName, ...sub] = modulePath.split("/");
      const pkgPath = path.join(
        root,
        "node_modules",
        moduleName,
        "package.json"
      );
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));

      let entry = pkg.module || pkg.main;
      if (!entry) {
        throw new Error(`Module entry not found: ${moduleName}`);
      }

      const getPath = sub.length
        ? path.join(root, "node_modules", moduleName, ...sub)
        : path.join(root, "node_modules", moduleName, entry);

      let content = await fs.readFile(getPath, "utf-8");
      content = rewriteImports(content);
      res.setHeader("Content-Type", mimeTypes.js);
      return res.end(content);
    }
    const filePath = path.join(root, pathname);
    const ext = pathname.split(".").pop();

    if (ext === "js") {
      let code = await fs.readFile(filePath, "utf-8");
      code = rewriteImports(code);
      res.setHeader("Content-Type", mimeTypes.js);
      return res.end(code);
    }

    const buf = await fs.readFile(filePath);
    res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
    res.end(buf);
  } catch (e) {
    console.error(e);
    res.statusCode = 404;
    res.end("Not Found");
  }
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
