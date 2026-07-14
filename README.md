<h3 align="center"> Komari Naive Extended </h3>
<p align="center">基于 Vue 3 + Vite + Naive UI 构建的 Komari Monitor 扩展主题</p>
<a href="https://github.com/oKafuChino/komari-theme-navie-extended">
<img src="docs/preview.png" alt="Komari Naive Extended" />
</a>

本项目基于 [lyimoexiao/komari-theme-naive](https://github.com/lyimoexiao/komari-theme-naive) 开发，并保留原项目的 MIT 许可证与作者署名。

## 使用

1. 从 [Release 页面](https://github.com/oKafuChino/komari-theme-navie-extended/releases) 下载最新的 `komari-theme-naive-extended-build-*.zip` 文件
2. 登录 Komari Monitor 后，点击 `设置`，选择 `主题管理` 选项卡
3. 点击 `上传主题` 按钮，选择下载的 `komari-theme-naive-extended-build-*.zip` 文件
4. 刷新页面，即可看到新的主题

## Live2D 看板娘

主题可在公共探针页面左下角显示管理员提供的 Cubism 3/4 Live2D 模型。该功能默认关闭，不修改 Komari 后端，也不会新增数据库、服务进程或服务端定时任务。

安装模型：

1. 解压 Release ZIP
2. 将完整模型复制到 `dist/live2d/model/`，保持模型内部相对目录不变
3. 重新压缩根目录中的 `dist/`、`komari-theme.json` 和 `preview.png`
4. 上传主题，在主题设置中启用 `Live2D 看板娘`，填写入口路径，例如 `/live2d/model/model.model3.json`

Release 默认不包含任何角色模型。请仅部署你有权公开展示的模型；纹理内存与目录要求见压缩包中的 `dist/live2d/model/README.txt`。

首次问候会由访客浏览器直接请求 `https://api64.ipify.org?format=json` 获取公网 IP。ipify 会接触该 IP；主题和 Komari 不会保存 IP，只在当前浏览器会话中保存“已问候”和“已关闭”标记。模型或 IP 服务失败不会影响探针页面。

## 环境要求

- Node.js: `^20.19.0` 或 `>=22.12.0`
- pnpm: `^10.28.2`

## 开发

```bash
# 安装依赖
pnpm i

# 启动开发服务器
pnpm dev

# 代码检查
pnpm lint
```

## 构建

```bash
# 类型检查 + 生产构建
pnpm build

# 预览生产构建
pnpm preview
```

## 技术栈

| 类别      | 技术                                       |
| --------- | ------------------------------------------ |
| 框架      | Vue 3 (Composition API + `<script setup>`) |
| 构建工具  | Vite 7                                     |
| UI 组件库 | Naive UI                                   |
| 状态管理  | Pinia 3                                    |
| 路由      | Vue Router 5                               |
| CSS 方案  | UnoCSS (Wind4 preset) + SCSS               |
| 图表库    | ECharts + vue-echarts                      |
| 代码规范  | ESLint (@antfu/eslint-config) + oxlint     |

## 参考

- [Komari](https://github.com/komari-monitor/komari)
- [Komari Next](https://github.com/tonyliuzj/komari-next)
- [Vue 3](https://vuejs.org/)
- [Vite](https://vitejs.dev/)
- [Naive UI](https://www.naiveui.com/)
- [UnoCSS](https://unocss.dev/)

## License

[MIT](./LICENSE)
