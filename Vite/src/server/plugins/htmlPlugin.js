export function htmlPlugin() {
  return {
    name: "vite:html",
    // 在 <head> 注入 HMR 客户端
    transformIndexHtml: (url, html) => {
      const clientScript = `<script type="module" src="/@vite/client"></script>`;
      return html.replace(/<head>/, `<head>\n  ${clientScript}`);
    },
  };
}
