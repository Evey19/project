// 在 src/Module.js 中

const { analyse } = require("./ast/analyze.js");
const MagicString = require("magic-string");
const acorn = require("acorn");
const fs = require("fs");
// ... 其他 require

class Module {
  constructor({ id, graph }) {
    this.id = id;
    this.graph = graph;
    // ... 其他属性 ...
    this.code = null;
    this.originalCode = null;
    this.magicString = null;
    this.ast = null;
    this.imports = {};
    this.exports = {};
    this.definitions = {}; // 存储顶级声明节点 { name: Node }
    this.references = {}; // { name: [{ node: IdentifierNode, definingNode: Node }] }
    this.potentialGlobals = new Set();
    this.includedStatements = new Set(); // 用于 Tree-shaking

    try {
      this._load();
      this._preliminaryAnalysis(); // 初步分析导入导出和顶级定义
      this._analyse(); // 调用深入分析
    } catch (err) {
      console.error(`处理模块 ${this.id} 出错:`, err);
      // 可能需要向上抛出或标记模块为错误状态
      throw err;
    }
  }

  _load() {
    this.originalCode = fs.readFileSync(this.id, "utf-8");
    this.code = this.originalCode;
    this.magicString = new MagicString(this.code);
    try {
      this.ast = acorn.parse(this.code, {
        ecmaVersion: 2020,
        sourceType: "module",
        locations: true, // 可选，但对 sourcemap 和错误报告有用
      });
    } catch (parseError) {
      console.error(`解析 AST 失败 ${this.id}: ${parseError.message}`);
      throw parseError;
    }
  }

  _preliminaryAnalysis() {
    // 之前的 _analyse 逻辑，用于快速识别导入/导出和顶级定义
    // 可以简化，因为 analyse 会做更详细的
    this.ast.body.forEach((node) => {
      // 记录顶级定义
      if (node.type === "VariableDeclaration") {
        node.declarations.forEach((d) => (this.definitions[d.id.name] = node));
      } else if (
        node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration"
      ) {
        if (node.id) this.definitions[node.id.name] = node;
      }
      // 记录导入
      if (node.type === "ImportDeclaration") {
        /* ... */
      }
      // 记录导出
      if (node.type === "ExportNamedDeclaration") {
        /* ... */
      }
      if (node.type === "ExportDefaultDeclaration") {
        /* ... */
      }

      // *** 关键补充: 预先为节点添加 _defines ***
      // 这有助于 analyse.js 快速找到顶级声明
      node._defines = {};
      if (node.type === "VariableDeclaration") {
        node.declarations.forEach((d) => (node._defines[d.id.name] = true));
      } else if (
        node.type === "FunctionDeclaration" ||
        node.type === "ClassDeclaration"
      ) {
        if (node.id) node._defines[node.id.name] = true;
      } else if (node.type === "ImportDeclaration") {
        node.specifiers.forEach((s) => (node._defines[s.local.name] = true));
      }
    });
  }

  _analyse() {
    // 调用 analyse.js 进行深入分析
    analyse(this.ast, this.magicString, this);
  }

  addReference(name, definingNode) {
    if (!this.references[name]) {
      this.references[name] = [];
    }
    // 存储引用信息，可能需要更详细，例如引用的节点本身
    this.references[name].push({ definingNode });
    // console.log(`Reference added for '${name}' in ${this.id}`);
  }

  addPotentialGlobal(name) {
    this.potentialGlobals.add(name);
    // console.warn(`Potential global reference '${name}' found in ${this.id}`);
  }

  // ... (markAsIncluded 等用于 Tree-shaking 的方法) ...
}

module.exports = Module;
