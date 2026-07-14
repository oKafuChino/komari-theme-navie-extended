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

模型与主题包相互独立，更新主题时不需要重新打包或上传模型。安装模型：

1. 在反向代理或同源静态服务器中创建持久路径 `/live2d-model/`，该目录不能位于 Komari 主题目录内
2. 将完整的 Cubism 3/4 模型复制到这个目录，保持 `.model3.json` 内声明的相对目录结构不变
3. 确认浏览器可直接访问入口，例如 `https://monitor.example.com/live2d-model/model.model3.json`
4. 在主题设置中启用 `Live2D 看板娘`，填写同源入口路径 `/live2d-model/model.model3.json`

Komari 不会自动创建或托管这个外置目录；请通过现有反向代理或静态服务器映射它，这不需要修改 Komari 后端。旧的 `/live2d/model/...` 入口仍可加载，方便已有部署迁移，但位于主题包内的模型仍可能在主题更新时丢失。

Release 不包含任何角色模型。请仅部署你有权公开展示的模型。建议将 4096 像素纹理降至 2048 像素：单张解码内存可由约 64 MiB 降至约 16 MiB，在看板娘显示尺寸下通常没有明显损失。

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
