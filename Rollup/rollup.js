const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

/**
 * 打包入口函数
 * @param {string} entryFile 入口文件路径
 * @param {string} outputFile 输出文件路径
 */
async function build(entryFile, outputFile) {}

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

    const dependencies = [];
    const imports = {};
    const exports = {};

    // 遍历AST节点查找import和export
    ast.body.forEach((node) => {
      if (node.type === "ImportDeclaration") {
        const source = node.source.value;
      }
    });
  } catch (error) {}
}
