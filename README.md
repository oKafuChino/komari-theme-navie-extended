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

1. 下载 `komari-live2d-model-pack-template.zip` 并解压。
2. 将完整 Cubism 3/4 模型复制到资源包的 `dist/model/`，保持模型内部相对目录不变。
3. 重新压缩根目录中的 `dist/`、`komari-theme.json` 和 `preview.png`，不要额外包一层父目录。
4. 在 Komari 主题管理中上传资源包。该包的标识为 `komari-live2d-models`，请勿将它设为当前主题，也请勿删除。
5. 安装并启用正常的 Komari Naive Extended 主主题。
6. 在主主题设置中启用看板娘并填写入口，例如 `/themes/komari-live2d-models/dist/model/model.model3.json`。嵌套入口同样受支持。

模型资源包只需首次安装。之后更新主主题只会替换 `NaiveExtended` 主题目录，不会删除独立的 `komari-live2d-models` 模型资源；重新上传或删除资源包才会替换或移除模型。

资源包模板不包含任何角色模型。请仅部署你有权公开展示的模型；纹理内存与目录要求见资源包中的 `dist/model/README.txt`。资源包由 Komari 原生 `/themes/:id/*path` 静态路由提供，因此 Docker、1Panel、宝塔、systemd、二进制运行和反向代理部署均不需要额外路径配置。Komari 返回静态模型文件时会产生与文件大小相关的单次瞬时内存占用；压缩包体积不代表浏览器解码后的纹理内存，建议纹理不超过 2048x2048 并移除不需要的动作和声音。

首次问候会由访客浏览器直接请求 `https://api64.ipify.org?format=json` 获取公网 IP。ipify 会接触该 IP；主题和 Komari 不会保存 IP，只在当前浏览器会话中保存“已问候”和“已关闭”标记。模型或 IP 服务失败不会影响探针页面。

## 剩余价值计算器

管理员可在主题设置中启用剩余价值计算器，并选择 CNY、USD、EUR 或 GBP 作为目标币种。计算只使用 Komari 已公开的价格、计费周期、币种和到期时间数据，并在访客浏览器中完成，不修改 Komari 后端。剩余天数复用探针页面已有显示，按完整天数向下取整。

访客首次打开计算器抽屉时，浏览器会请求 [Frankfurter](https://www.frankfurter.app/) 获取汇率；该服务会接触访客 IP。有效汇率在浏览器缓存 12 小时，网络失败时自动使用管理员配置的备用汇率。功能默认关闭，关闭或未打开抽屉时不会请求汇率。

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
