Dev Server 基于 Connect（或 Koa）＋原生 http
引入「插件容器」（PluginContainer），把所有功能点都拆成插件钩子（hook）
请求到达后，按顺序走：
① transformIndexHtml（HTML 注入 HMR 客户端、处理 <script>）
② 静态资源（CSS、图片等）直接交给静态中间件（sirv）
③ 模块请求（.js/.ts/.vue/.jsx…）——> 调用插件钩子：
• resolveId（定位文件真实路径）
• load （读取源内容，CommonJS→ESM／SFC → JS+CSS）
• transform（跑 esbuild、Babel、MagicString 重写裸导入／JSX／TS／SFC 等）
④ HMR WebSocket（文件监听 + ModuleGraph + import.meta.hot）
