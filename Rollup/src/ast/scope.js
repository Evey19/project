let scopeIdCounter = 0;

// 这段代码实现了一个作用域管理类 Scope，用于构建作用域链和处理变量声明

/**
 * const globalScope = new Scope();
 * const functionScope = new Scope({ parent: globalScope });
 * const blockScope = new Scope({ parent: functionScope, isBlockScope: true }); 
 */

class Scope {
  constructor(options = {}) {
    this.id = scopeIdCounter++;
    this.parent = options.parent || null;
    this.declarations = Object.create(null); // 保持绝对干净的对象或防止原型污染时，object.create(null)是更好的选择
    this.isBlockScope = !!options.isBlockScope;
  }

  add(name, declarationNode) {
    this.declarations[name] = declarationNode;
  }

  findDefiningScope(name) {
    if (this.declarations[name]) {
      return this;
    }
    if (this.parent) {
      return this.parent.findDefiningScope(name);
    }
    return null;
  }

  contains(name) {
    return !!this.findDefiningScope(name);
  }
}

module.exports = Scope