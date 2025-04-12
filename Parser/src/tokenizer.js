export const TokenType = {
  EOF: "EOF", // End of File
  Identifier: "Identifier", // 标识符 (变量名、函数名等)
  Keyword: "Keyword", // 关键字 (if, else, const, let, etc.)
  Punctuator: "Punctuator", // 标点符号 ( { } ( ) ; , . etc.)
  NumericLiteral: "NumericLiteral", // 数字字面量
  StringLiteral: "StringLiteral", // 字符串字面量
  // 可以根据需要添加更多类型，如 RegularExpressionLiteral, TemplateLiteral 等
};

const keywords = new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "break",
  "continue",
  "return",
  "function",
  "var",
  "let",
  "const",
  "new",
  "this",
  "class",
  "super",
  "import",
  "export",
  "default",
  "try",
  "catch",
  "finally",
  "throw",
  "debugger",
  "with",
  "null",
  "true",
  "false",
  "in",
  "instanceof",
  "typeof",
  "void",
  "delete",
  "async",
  "await",
  "yield",
]);

export class Tokenizer{
    constructor(input){
        this._input = input;
        this._index=0;
        this._length = input.length
        this.currentLine = 1;
        this.lineStartIndex = 0;
    }

    _skipWhitespaceAndComments(){
        while(this._index<this._length){
            const char = this._input[this._index];
            
        }
    }
}