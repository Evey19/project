const path = require("path");
const rollup = require("../src/index.js");

const entry = path.resolve(process.cwd(), process.argv[2]);
const output = path.resolve(process.cwd(), process.argv[3] || "bundle.js");

console.log(`入口文件: ${entry}`);
console.log(`输出文件: ${output}`);

rollup({ entry, output }).catch((err) => {
  console.log("打包出错", err);
  process.exit(1);
});

console.log("打包脚本执行完毕");
