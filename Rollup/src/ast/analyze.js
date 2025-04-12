const Scope = require('./scope');
const walk = require('./walk');

/**
 * 分析模块的 AST，构建作用域链并识别引用
 * @param {Node} ast - AST 根节点 (Program)
 * @param {MagicString} magicString - 用于代码操作的 MagicString 实例
 * @param {Module} module - 当前模块实例，用于存储分析结果
 */
function analyse(ast, magicString, module) {
    let currentScope = new Scope(); // 模块根作用域

    // 1. 预扫描，找出所有顶级作用域的声明（var 会提升，let/const 不会，但先记录）
    ast.body.forEach(statement => {
        Object.keys(statement._defines).forEach(name => {
            currentScope.add(name, statement); // 记录声明节点
        });
    });

    let statementIndex = 0; // 用于跟踪语句顺序，辅助判断 TDZ (暂时性死区)

    // 2. 遍历 AST，构建作用域链，查找引用
    walk(ast, {
        enter(node, parent) {
            // 进入新作用域
            if (node._scope) {
                 // 如果节点创建了作用域 (由 acorn-walk 或类似工具标记)
                 // 或者根据类型判断 (FunctionDeclaration, FunctionExpression, BlockStatement for let/const)
                let newScope;
                if (node.type === 'BlockStatement' && (!parent || !parent.type.includes('Function'))) {
                     newScope = new Scope({ parent: currentScope, isBlockScope: true });
                } else if (node.type.includes('Function')) {
                     newScope = new Scope({ parent: currentScope });
                     // 将函数参数添加到新作用域
                    node.params.forEach(param => {
                        // 处理各种参数形式: Identifier, AssignmentPattern, RestElement, ObjectPattern, ArrayPattern
                        addPatternDeclarations(param, newScope, node); // 需要实现 addPatternDeclarations
                    });
                    // 如果是具名函数声明，将其名称添加到自身作用域
                    if (node.type === 'FunctionDeclaration' && node.id) {
                        newScope.add(node.id.name, node);
                    }
                } else {
                    newScope = currentScope; // 默认不创建新作用域
                }
                 currentScope = newScope;
            }

            // 记录语句索引
            if (parent === ast) { // 假设 ast.body 中的顶级节点是语句
                 node._statementIndex = statementIndex++;
            }

            // 处理声明 (主要处理块级作用域内的声明)
             if (node.type === 'VariableDeclaration') {
                 const isBlockDeclaration = node.kind !== 'var'; // let 或 const
                 node.declarations.forEach(declarator => {
                     if (isBlockDeclaration || currentScope.parent === null) { // 块级声明或顶级 var
                         currentScope.add(declarator.id.name, declarator);
                     } else {
                         // var 声明提升到函数作用域或全局作用域
                         let hoistingScope = currentScope;
                         while(hoistingScope.parent && !hoistingScope.isBlockScope) { // 找到最近的函数或全局作用域
                             hoistingScope = hoistingScope.parent;
                         }
                         hoistingScope.add(declarator.id.name, declarator);
                     }
                 });
             } else if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
                // 函数和类声明是块级作用域的 (在严格模式下)
                 if (node.id) {
                     currentScope.add(node.id.name, node);
                 }
             }
        },
        leave(node, parent) {
            // 离开作用域
             if (node._scope || (node.type === 'BlockStatement' && (!parent || !parent.type.includes('Function'))) || node.type.includes('Function')) {
                currentScope = currentScope.parent;
            }
        }
    }, {
        // 可以添加特定节点的访问者，例如专门处理 Identifier
        Identifier: (node, parent, callback) => {
            // 检查 Identifier 是否是引用而不是声明的一部分
            if (isReference(node, parent)) {
                // 查找定义该标识符的作用域
                const definingScope = currentScope.findDefiningScope(node.name);
                if (definingScope) {
                    // 找到了定义，将其标记为引用
                    module.addReference(node.name, definingScope.declarations[node.name]);
                } else if (!module.graph.scope.contains(node.name)) { // 检查是否为全局变量（需要 Graph 实例有全局作用域信息）
                     // 可能是未声明的全局变量或 Rollup 需要处理的外部依赖
                    module.addPotentialGlobal(node.name);
                    // console.warn(`Unresolved reference: ${node.name} in ${module.id}`);
                }
            }
            // 继续遍历 Identifier 可能的子节点 (虽然 Identifier 通常没有)
            visitNode(node, parent, callback); // 使用 walk.js 的默认访问器
        }
        // 可以添加更多特定节点的访问器...
    });

     // 3. 标记导出语句引用的变量为 "included" (Tree-shaking 入口)
    // 这个逻辑现在移到 Module.js 的 _analyse 或一个专门的 tree-shaking 阶段更合适
    // 但基本思路是：找到 export 对应的 localName，然后找到该 localName 的定义，并标记

     ast._scope = currentScope; // 将最终的作用域附加到 AST 根节点（可选）
}


/**
 * 辅助函数：判断一个 Identifier 节点是否是引用，而不是声明的一部分
 * @param {Node} node - Identifier 节点
 * @param {Node} parent - Identifier 节点的父节点
 * @returns {boolean}
 */
function isReference(node, parent) {
    if (!parent) return true; // 根节点？不太可能

    // 作为变量声明的 ID
    if (parent.type === 'VariableDeclarator' && parent.id === node) return false;
    // 作为函数/类声明的 ID
    if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ClassDeclaration' || parent.type === 'ClassExpression') && parent.id === node) return false;
    // 作为函数/方法参数
    if ((parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression') && parent.params.includes(node)) return false;
    // 作为对象属性的 key (非计算属性)
    if (parent.type === 'Property' && parent.key === node && !parent.computed) return false;
    // 作为对象方法的 key (非计算属性)
    if (parent.type === 'MethodDefinition' && parent.key === node && !parent.computed) return false;
    // 作为成员表达式的属性 (非计算属性) e.g., obj.prop
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return false;
    // 作为 import specifier 的本地名称
    if ((parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier' || parent.type === 'ImportNamespaceSpecifier') && parent.local === node) return false;
    // 作为 export specifier 的本地名称或导出名称
    if (parent.type === 'ExportSpecifier' && (parent.local === node || parent.exported === node)) return false; // Review: exported name might be considered a reference in some contexts?
     // 作为标签语句的标签
     if (parent.type === 'LabeledStatement' && parent.label === node) return false;
     if ((parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && parent.label === node) return false;


    // 其他情况，认为是引用
    return true;
}

/**
 * 辅助函数：递归处理模式（Patterns）中的声明，用于函数参数和变量解构
 * @param {Node} patternNode - 参数或解构模式节点 (Identifier, ObjectPattern, ArrayPattern, etc.)
 * @param {Scope} scope - 要添加声明的作用域
 * @param {Node} declarationContextNode - 相关的声明节点 (e.g., FunctionDeclaration)
 */
 function addPatternDeclarations(patternNode, scope, declarationContextNode) {
    if (!patternNode) return;
    switch (patternNode.type) {
        case 'Identifier':
            scope.add(patternNode.name, patternNode); // 参数本身也是声明
            break;
        case 'AssignmentPattern': // let { x = 10 } = {} / function(a = 1) {}
            addPatternDeclarations(patternNode.left, scope, declarationContextNode);
            break;
        case 'RestElement': // function(...args) {} / let [...rest] = []
            addPatternDeclarations(patternNode.argument, scope, declarationContextNode);
            break;
        case 'ObjectPattern': // let {a, b: c} = {}
            patternNode.properties.forEach(prop => {
                if (prop.type === 'Property') { // 普通属性
                    addPatternDeclarations(prop.value, scope, declarationContextNode);
                } else if (prop.type === 'RestElement') { // ...rest
                    addPatternDeclarations(prop.argument, scope, declarationContextNode);
                }
            });
            break;
        case 'ArrayPattern': // let [a, , b] = []
            patternNode.elements.forEach(element => {
                if (element) { // Skip holes in arrays
                    addPatternDeclarations(element, scope, declarationContextNode);
                }
            });
            break;
        // 其他模式类型可以按需添加
    }
}


// 重新导入 visitNode 以便在 Identifier 访问器中使用
const { visitNode } = require('./walk');


module.exports = { analyse };
