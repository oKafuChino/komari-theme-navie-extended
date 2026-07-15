Live2D 独立模型资源包

1. 将完整的 Cubism 3/4 模型复制到本目录 dist/model/，保持模型内部相对目录不变。
2. 找到模型入口 .model3.json；入口可以使用任意文件名或嵌套目录。
3. 重新压缩 ZIP 根目录中的 komari-theme.json、preview.png 和 dist/，不要额外包一层父目录。
4. 在 Komari 主题管理中上传该资源包，但请勿将它设为当前主题，也请勿删除。
5. 在 Komari Naive Extended 设置中填写浏览器中实际能够访问的入口：
   Komari 1.2.6 及以上使用：
   /themes/komari-live2d-models/dist/model/model.model3.json
   /themes/komari-live2d-models/dist/model/chino/chino.model3.json
   旧版 Komari 使用：
   /theme/komari-live2d-models/dist/model/model.model3.json

建议使用不超过 2048x2048 的纹理。单张未压缩 RGBA 纹理约占：
- 2048x2048：16 MiB
- 4096x4096：64 MiB

请移除不需要的动作和声音，并仅部署你有权公开展示的模型。
