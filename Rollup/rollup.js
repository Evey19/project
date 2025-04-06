const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

/**
 * 打包入口函数
 * @param {string} entryFile 入口文件路径
 * @param {string} outputFile 输出文件路径
 */
async function build(entryFile, outputFile) {
  console.log(`开始构建: ${entryFile} -> ${outputFile}`);
  try {
    const absoluteEntryPath = path.resolve(entryFile);
    const graph = await buildDependencyGraph(absoluteEntryPath);
    await generateBundle(graph, outputFile, absoluteEntryPath);
    console.log(`构建完成: ${outputFile}`);
  } catch (error) {
    console.error("构建过程中发生错误:", error);
  }
}

/**
 * 构建依赖图
 * @param {string} entryPath 入口文件的绝对路径
 * @returns {Promise<Map<string, object>>} 模块依赖图 (filePath -> moduleInfo)
 */

async function buildDependencyGraph(entryPath) {
  const graph = new Map();
  const queue = [entryPath];
  const visited = new Set([entryPath]); // 记录已访问的模块，防止循环依赖导致的死循环

  while (queue.length > 0) {
    const currentPath = queue.shift();
    console.log(`  正在解析模块: ${path.relative(process.cwd(), currentPath)}`); // 显示相对路径，更清晰
    try {
      const moduleInfo = await parseModule(currentPath);
      if (!moduleInfo) continue;
      graph.set(currentPath, moduleInfo);
      const parentDir = path.dirname(currentPath);
      for (const relativeDepPath of moduleInfo.dependencies) {
        // 将相对路径转换为绝对路径
        const absoluteDepPath = path.resolve(parentDir, relativeDepPath);

        if (!visited.has(absoluteDepPath)) {
          visited.add(absoluteDepPath);
          queue.push(absoluteDepPath);
        }
      }
    } catch (error) {
      console.error(`  处理模块 ${currentPath} 时出错:`, error.message);
    }
  }
  console.log("依赖图构建完成");
  return graph;
}

/**
 * 解析单个模块文件
 * @param {string} filePath 文件路径
 * @returns {Promise<object|null>} 模块信息对象或 null (如果失败)
 */
async function parseModule(filePath) {
  try {
    const absolutePath = path.resolve(__dirname, filePath); // 获取绝对路径
    const code = await fs.promises.readFile(absolutePath, "utf-8");
    // 使用acorn解析AST
    const ast = acorn.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    });

    const dependencies = new Set(); // Use a Set to avoid duplicate dependencies
    const imports = {};
    const exports = {};

    // 遍历AST节点查找import和export
    ast.body.forEach((node) => {
      // --- Import Declarations ---
      if (node.type === "ImportDeclaration") {
        const source = node.source.value;
        dependencies.add(source);
        node.specifiers.forEach((specifier) => {
          const localName = specifier.local.name;
          if (specifier.type === "ImportDefaultSpecifier") {
            imports[localName] = { source, name: "default" };
          } else if (specifier.type === "ImportSpecifier") {
            const importedName = specifier.imported.name;
            imports[localName] = { source, name: importedName };
          } else if (specifier.type === "ImportNamespaceSpecifier") {
            // Handle namespace imports (e.g., import * as utils from './utils')
            // This might require different handling depending on the bundler's strategy
            imports[localName] = { source, name: "*" };
          }
        });
      }
      // --- Export Named Declarations ---
      else if (node.type === "ExportNamedDeclaration") {
        const sourceModule = node.source ? node.source.value : null; // Check if it's a re-export

        // Case 1: export const/let/var/function/class ... (Declaration exists)
        if (node.declaration) {
          if (node.declaration.type === "VariableDeclaration") {
            node.declaration.declarations.forEach((declaration) => {
              const name = declaration.id.name;
              exports[name] = {
                localName: name,
                exportedName: name,
                source: null,
              }; // Added source: null
            });
          } else {
            // FunctionDeclaration, ClassDeclaration
            const name = node.declaration.id.name;
            exports[name] = {
              localName: name,
              exportedName: name,
              source: null,
            }; // Added source: null
          }
        }
        // Case 2 & 3: export { foo, bar as baz }; or export { foo } from './mod'; (Specifiers exist)
        else if (node.specifiers.length > 0) {
          if (sourceModule) {
            dependencies.add(sourceModule); // Add dependency if re-exporting
          }
          node.specifiers.forEach((specifier) => {
            const localName = specifier.local.name; // name used locally OR in the source module if re-exporting
            const exportedName = specifier.exported.name; // name this module exports it as
            exports[exportedName] = {
              localName: localName,
              exportedName: exportedName,
              source: sourceModule, // Store the source module path (null if not a re-export)
            };
          });
        }

        // Case 3 (covered by above): export { foo } from './mod';
        // The standalone 'if (node.source)' check might be redundant now if handled within specifiers.
        // You can double-check if there are cases where node.source exists without specifiers/declaration.
      }
      // --- Export Default Declaration ---
      else if (node.type === "ExportDefaultDeclaration") {
        let localName = "_default"; // Internal temporary name
        let isAnonymous = true; // Flag for anonymous declarations

        // Handle `export default function foo() {}` or `export default class Bar {}`
        if (node.declaration.id) {
          localName = node.declaration.id.name;
          isAnonymous = false;
        } else if (node.declaration.type === "Identifier") {
          // Handle `export default foo;` where foo is declared elsewhere
          localName = node.declaration.name;
          isAnonymous = false; // It refers to a named entity
        }
        // else: Anonymous function/class/expression. Keep localName as '_default'.

        // We store the local name (even if temporary like '_default')
        exports["default"] = {
          localName: localName,
          exportedName: "default",
          // Optionally add 'isAnonymous' if needed later
          // isAnonymous: isAnonymous
        };
      }
      // --- Export All Declaration ---
      else if (node.type === "ExportAllDeclaration") {
        const source = node.source.value;
        dependencies.add(source);
        if (node.exported) {
          // Handles `export * as ns from './module';`
          const exportedName = node.exported.name;
          exports[exportedName] = {
            localName: "*", // Special indicator for namespace re-export
            exportedName: exportedName,
            source: source,
          };
        } else {
          // Handles `export * from './module';`
          if (!exports["*"]) exports["*"] = [];
          // Store the source module for star exports
          exports["*"].push({ source: source });
        }
      }
    });

    return {
      filePath,
      dependencies: Array.from(dependencies), // Convert Set back to Array
      imports,
      exports,
      code, // Return code and AST for later use (e.g., transformations)
      ast,
    };
  } catch (error) {
    console.error(`Failed to parse module: ${filePath}`, error);
    // Re-throw or handle the error appropriately
    throw error;
  }
}
