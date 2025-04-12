// ast/walk.js

/**
 * 简单的递归 AST 遍历器
 * @param {Node} ast - 要遍历的 AST 根节点
 * @param {object} visitor - 访问者对象，包含 enter 和 leave 方法
 * @param {function} visitor.enter - 进入节点时调用的函数 (node, parent) => void
 * @param {function} visitor.leave - 离开节点时调用的函数 (node, parent) => void
 * @param {object} [baseVisitor] - 可选的基础访问者，用于覆盖特定节点类型
 */
function walk(ast, { enter, leave }, baseVisitor = {}) {
  visit(ast, null, enter, leave, baseVisitor);
}

/**
 * 递归访问函数
 * @param {Node} node - 当前节点
 * @param {Node|null} parent - 父节点
 * @param {function} enter - 进入回调
 * @param {function} leave - 离开回调
 * @param {object} baseVisitor - 基础访问者
 */
function visit(node, parent, enter, leave, baseVisitor) {
  if (!node) return;

  const visitorFunc = baseVisitor[node.type] || visitNode;

  if (enter) {
    enter(node, parent);
  }

  visitorFunc(node, parent, (child, childParent) => {
    visit(child, childParent || node, enter, leave, baseVisitor);
  });

  if (leave) {
    leave(node, parent);
  }
}

/**
 * 默认的节点访问逻辑，遍历所有可能的子节点
 * @param {Node} node - 当前节点
 * @param {Node|null} parent - 父节点
 * @param {function} callback - 对每个子节点调用的回调 (child, parent) => void
 */
function visitNode(node, parent, callback) {
  // 遍历对象的所有属性
  for (const key in node) {
    if (key === "parent") continue; // 避免循环引用（如果 AST 被修改过）
    const value = node[key];

    if (Array.isArray(value)) {
      // 如果属性是数组，遍历数组中的每个元素
      value.forEach((child) => {
        if (child && typeof child.type === "string") {
          // 确保是 AST 节点
          callback(child, node);
        }
      });
    } else if (value && typeof value.type === "string") {
      // 如果属性是单个 AST 节点
      callback(value, node);
    }
  }
}

module.exports = walk;
