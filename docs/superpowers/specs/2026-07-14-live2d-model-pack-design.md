# Live2D 独立资源包设计

## 概要

将 Live2D 模型从 `komari-theme-naive-extended` 主主题中拆出，制作成一个独立的 Komari 资源主题包。管理员首次上传资源包后，主主题通过 Komari 原生主题静态路由读取模型；后续更新主主题时不会覆盖模型文件。

本方案不修改 Komari 后端、不新增服务器进程、不要求 Nginx/OpenResty/Caddy 配置，也不依赖 1Panel、Docker 或某一种安装方式。模型仍然保存在部署 Komari 主控的 VPS 上，并由同一个 Komari HTTP 服务提供给访客。

本设计只处理模型持久化和主题更新解耦。看板娘的欢迎语、点击消息、关闭按钮、缩放、帧率和生命周期沿用现有 Live2D Companion 设计。

## 目标

- 让管理员只上传一次模型资源包，之后可以从 Komari 管理页正常更新主主题。
- 让模型文件不属于主主题目录，因此主主题更新不会删除模型。
- 兼容 Docker、1Panel、宝塔、systemd、二进制和直接运行等部署方式。
- 不要求管理员知道 Komari 的宿主机路径、容器路径或反向代理配置。
- 保留管理员自定义模型入口文件名和目录结构，不强制重命名模型文件。
- 让主主题 Release 不包含任何第三方角色模型或模型二进制。
- 继续保持模型加载、渲染和销毁对访客性能的低开销。

## 非目标

- 不修改 Komari 后端源代码、路由、数据库结构或主题更新逻辑。
- 不增加 Komari 公共上传 API。
- 不在公共页面提供模型上传控件。
- 不支持多个模型之间的访客侧切换。
- 不通过外部 CDN、对象存储或独立域名加载模型。
- 不支持 Cubism 2 `.model.json`。
- 不把用户提供的 XFZN 模型或其他角色资源提交到仓库、`public/`、`dist/` 或 Release。

## 关键依据

Komari 当前的静态主题路由支持：

```text
/themes/:id/*path
```

该路由从 `./data/theme/<id>/` 读取文件并返回给浏览器。主题更新时，Komari 只删除并重建本次更新主题对应的 `short` 目录。因此，将模型放在独立 `short` 的资源主题中，可以避开主主题目录的删除操作。

实现依据：

- [Komari `web/public/public.go`](https://github.com/komari-monitor/komari/blob/5c73eba475a5d83164aacd7b5b1a71b8f20858fd/web/public/public.go)
- [Komari `web/api/admin/theme.go`](https://github.com/komari-monitor/komari/blob/5c73eba475a5d83164aacd7b5b1a71b8f20858fd/web/api/admin/theme.go#L221-L234)

## 发布物和目录结构

每次主主题构建产生两个独立产物：

```text
komari-theme-naive-extended-build-<sha>.zip
komari-live2d-model-pack-template.zip
```

主主题 ZIP 保持现有 Komari 发布契约：

```text
dist/
komari-theme.json
preview.png
```

模型资源包模板结构：

```text
komari-live2d-model-pack-template.zip
├── komari-theme.json
├── preview.png
└── dist/
    ├── index.html
    └── model/
        └── README.txt
```

模板不包含 `.model3.json`、`.moc3`、纹理、动作、声音或任何角色二进制。管理员解压模板后，将自己的完整模型原样复制到 `dist/model/`，保留模型内部引用的相对目录，然后重新压缩并上传。

资源包使用固定的主题短名称：

```json
{
  "name": "Live2D 模型资源包（请勿设为当前主题）",
  "short": "komari-live2d-models",
  "version": "1.0.0",
  "configuration": {
    "type": "managed",
    "data": []
  }
}
```

`dist/index.html` 是最小提示页，说明该包只用于存储模型，并提供返回 Komari 管理页的链接。这样误将资源包设为当前主题时不会出现空白页。

## 管理员工作流

首次配置：

1. 下载 `komari-live2d-model-pack-template.zip` 并解压。
2. 将完整 Cubism 3/4 模型目录复制到 `dist/model/`，不改变相对结构。
3. 找到入口 `.model3.json` 文件的相对路径。
4. 重新压缩 ZIP 根目录中的 `komari-theme.json`、`preview.png` 和 `dist/`，不要多包一层父目录。
5. 在 Komari 管理页上传该 ZIP，使其安装为 `komari-live2d-models`。
6. 安装并启用 `komari-theme-naive-extended` 主主题。
7. 在主主题设置中填写入口路径，例如：

```text
/themes/komari-live2d-models/dist/model/XFZN.model3.json
/themes/komari-live2d-models/dist/model/chino/chino.model3.json
```

更新主主题时，只更新主主题 ZIP，不重新打包模型。更新模型时，重新制作并上传相同 `short` 的资源包即可。重新上传资源包会替换模型资源，但不会改变主主题代码或设置。

资源包会出现在 Komari 的主题列表中。名称、预览图和提示页必须明确写出“请勿设为当前主题、请勿删除”，文档也必须说明删除该包会使看板娘不可用。

## 主主题配置

保留以下配置项：

| Key | 名称 | 类型 | 默认值 | 约束 |
| --- | --- | --- | --- | --- |
| `live2dEnabled` | 启用 Live2D 看板娘 | `switch` | `false` | Boolean |
| `live2dModelPath` | Live2D 模型入口 | `string` | `/themes/komari-live2d-models/dist/model/model.model3.json` | 固定资源包目录下的 `.model3.json` 路径 |
| `live2dScale` | Live2D 显示缩放 | `number` | `100` | 有限数字，运行时限制为 `50-150` |

不要求入口文件统一命名。管理员可以填写任意实际入口文件名和嵌套目录，只要它满足路径约束。由于本主题尚未正式发布，不保留旧的 `/live2d/model/` 兼容路径。

主主题只在 `live2dEnabled` 为 `true` 且页面运行在公开探针路由时加载模型。禁用状态不能预加载模型 JSON、纹理、Pixi、Live2D Core 或 IP 服务。

## 路径和资源安全

`live2dModelPath` 必须满足全部条件：

- 是同源站内相对路径。
- 以 `/themes/komari-live2d-models/dist/model/` 开头。
- 以 `.model3.json` 结尾。
- 不包含 `?query`、`#fragment`、反斜杠、用户名密码或协议前缀。
- 规范化后不能包含 `..` 路径段。
- 不能指向主主题、其他资源主题、`/api/`、`/admin/` 或任意外部域名。

模型入口 JSON 的 `FileReferences` 中，以下字段按存在性进行校验：

- `Moc`
- `Textures`
- `Physics`
- `Pose`
- `DisplayInfo`
- `UserData`
- `Expressions[*].File`
- `Motions.*[*].File`
- `Motions.*[*].Sound`

引用必须使用相对路径，解析后保持同源并位于入口文件所在目录或其子目录内。拒绝 `http:`, `https:`, `//`, `data:`, `blob:`、规范化父目录越界和其他可执行协议。必需的 Moc 和纹理引用缺失时，整个模型拒绝加载；可选动作或表情缺失不应导致已经可用的基础模型崩溃。

## 加载和生命周期

1. Komari 返回主题设置。
2. App Store 防御性解析三个 Live2D 设置。
3. Live2D 组件确认功能启用、未被会话隐藏且浏览器具备所需 Canvas/WebGL 能力。
4. 页面首次可交互后，运行时在浏览器空闲时延迟加载 Cubism Core 和 Pixi/Live2D chunk。
5. 先请求并验证入口 JSON，再创建 WebGL 渲染器和模型。
6. 模型成功显示后才执行一次会话欢迎流程。
7. 路由切换复用全局组件，不创建第二个 Canvas 或第二个运行时实例。
8. 关闭、卸载、页面隐藏或致命错误时，停止并销毁模型、纹理、Pixi 应用、ticker、WebGL context、计时器和监听器。

## 性能约束

### 宿主机

- 不新增 Komari API、数据库、进程、worker、定时任务、轮询或 WebSocket。
- 模型请求由 Komari 原生静态主题路由处理。
- 不加入独立静态服务器、Service Worker 或服务端缓存进程。
- 资源包说明建议使用不超过 2048 的纹理并移除不需要的动作和声音。
- 文档必须说明 Komari 静态路由会读取文件后返回，较大的模型会提高单次请求瞬时内存；压缩包体积不能代表解码后的纹理内存。

### 访客浏览器

- Pixi、Live2D Core、模型和纹理全部延迟加载。
- 桌面端活动最高 60 FPS，空闲 15 FPS。
- 触屏端活动最高 24 FPS，空闲 12 FPS。
- `document.hidden` 时停止到 0 FPS，恢复时重新对齐时间。
- `prefers-reduced-motion: reduce` 时只渲染静态首帧。
- Canvas 只使用看板娘自身的有界视口，设备像素比上限为 1.5。
- 不使用全屏 Canvas、每帧 DOM 写入、额外滤镜、worker 或 OffscreenCanvas。
- 关闭看板娘后不保留隐藏的 WebGL 实例。
- 不注册 Service Worker，不使用 IndexedDB 或 Cache Storage 接管 Komari 全站缓存。

## 失败降级

以下情况只隐藏看板娘，不影响探针页面：

- 资源包未安装或入口文件不存在。
- 主题设置路径非法。
- JSON 格式错误或资源引用越界。
- Moc、纹理或运行时文件损坏。
- 浏览器不支持所需 WebGL 能力。
- Pixi、Cubism Core 或 Live2D 初始化失败。

失败处理要求：

- 每种初始化失败类别最多输出一条简洁控制台警告。
- 不进行无限自动重试。
- 不显示错误弹窗、空白 Canvas、堆栈、持续 Toast 或遮挡探针的错误卡片。
- 销毁逻辑必须幂等，允许关闭、卸载、部分初始化失败和热更新重复调用。

## 测试策略

### 单元测试

- 资源包固定前缀、扩展名和同源路径校验。
- 外部 URL、查询参数、反斜杠、编码路径穿越、其他主题路径和空值拒绝。
- 嵌套模型入口和合法相对引用通过。
- Moc、纹理等必需引用缺失时拒绝；可选动作缺失时允许基础模型。
- 禁用或会话隐藏时不加载运行时和模型。
- 模型 JSON 请求、渲染器初始化、关闭和部分初始化失败均能完成幂等销毁。
- 桌面 60/15 FPS、触屏 24/12 FPS、后台暂停和 reduced-motion 静态帧行为回归。
- 150% 缩放下完整 viewport 与模型 footprint 同步放大，不裁切。

### 构建和资源契约测试

- 主主题 ZIP 保持 `dist/`、`komari-theme.json`、`preview.png` 根结构和既有命名。
- 额外生成资源包模板 ZIP，且其 `short` 为 `komari-live2d-models`。
- 模板 ZIP 能通过 Komari 主题清单校验。
- 两个 ZIP 均不包含 XFZN 名称、角色纹理或任何模型二进制。
- 资源包模板包含提示页和 `dist/model/README.txt`。
- 主主题默认配置指向新的 `/themes/komari-live2d-models/dist/model/` 路径。
- 主主题构建不删除、复制或覆盖资源包目录。

### 浏览器验证

使用仓库外、未跟踪的本地模型进行手工验证：

- `/` 和 `/instance/:id` 只创建一个看板娘实例。
- 桌面与移动尺寸下模型、气泡、关闭按钮不遮挡核心探针信息。
- 成功加载、模型缺失、JSON 损坏、纹理缺失和 WebGL 不可用均能安静降级。
- 路由切换、页面隐藏、刷新、关闭和重新打开后无 Canvas、ticker、timer 或 WebGL 泄漏。
- 主主题更新后，资源包地址仍可访问，模型设置仍指向独立包。

## 验收标准

功能完成需要同时满足：

- 管理员可以在任意 Komari 部署方式中仅通过管理页上传一次资源包。
- 主主题 Release 不包含模型，后续主主题更新不会删除模型。
- 管理员可以使用任意合法 `.model3.json` 文件名和嵌套目录。
- 访客看到的模型、欢迎语、点击消息、关闭行为和既有性能策略不回归。
- 非法路径和越界引用无法加载。
- 资源包错误不会影响探针、主题切换、图表或其他页面功能。
- `pnpm test:unit`、`pnpm lint` 和 `pnpm build` 全部通过。
