import { defineConfig } from "vite";

/**
 * 单文件 ESM 产物（参照官方 token-meter 插件）：不做 external、不做动态
 * import——宿主通过 blob URL 加载 main.js，裸导入在那里无法解析。
 * 产物落在仓库根、与 manifest.json 同级（Obsidian 约定），宿主的
 * 「从本地目录安装」直接指向仓库根。
 *
 * 本插件只用 ctx.react.createElement（宿主 React 树内渲染），不 import
 * react，因此不需要 @vitejs/plugin-react，也不打包任何 React 副本。
 */
export default defineConfig({
  build: {
    outDir: ".",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: "src/main.ts",
      formats: ["es"],
      fileName: () => "main.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "styles.css" : (asset.name ?? "asset"),
      },
    },
  },
});
