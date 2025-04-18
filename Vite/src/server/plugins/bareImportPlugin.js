import fs from "fs/promises";
import path from "path";

export function bareImportPlugin(root) {
  return {
    name: "vite:bare-import",
    resolveId(source) {
      if (source.startsWith("/@modules/")) {
        return { id: source };
      }
      if (source.startsWith(".") || source.startsWith("/")) {
        return null;
      }
      return { id: `/@modules/${source}` };
    },
    async load(id) {
      if (!id.startsWith("/@modules/")) return null;
      const moduleName = id.replace("/@modules/", "").split("/")[0];
      const pkgPath = path.join(
        root,
        "node_modules",
        moduleName,
        "package.json"
      );
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
      const entry = pkg.module || pkg.main;
      const moduleFile = path.join(root, "node_modules", moduleName, entry);
      return fs.readFile(moduleFile, "utf-8");
    },
    transform(code, id) {
      if (id.startsWith("/@modules/") || id.endsWith(".js")) {
        const rewritten = code.replace(
          /(?:import|export)\s+([\s\S]+?)\s+from\s+['"]([^'".][^'"]*)['"]/g,
          (full, imports, spec) => {
            if (spec.startsWith(".") || spec.startsWith("/")) {
              return full;
            }
            return full.replace(spec, `/@modules/${spec}`);
          }
        );
        return { code: rewritten };
      }
      return null;
    },
  };
}
