Komari Naive Extended - Live2D 模型安装说明

支持格式
- 支持 Cubism 3/4 的 .model3.json 模型入口。
- 不支持旧版 Cubism 2 .model.json。
- 模型及其纹理、物理、动作和表情文件必须使用同源路径，并全部保留在本目录树内。

Release 安装步骤
1. 解压下载的主题 Release ZIP。
2. 将完整模型目录复制到 dist/live2d/model/，保持模型文件声明的相对目录结构不变。
3. 重新压缩根目录中的 dist/、komari-theme.json 和 preview.png，不要增加额外的外层目录。
4. 上传到 Komari 后，在主题设置中启用 Live2D 看板娘，并填写入口路径，例如：
   /live2d/model/model.model3.json

性能建议
- 4096 x 4096 RGBA 纹理解码后约占用 64 MiB 显存。
- 看板娘实际显示宽度约为 200-320 px，优先使用 2048 x 2048 纹理，解码后约占用 16 MiB 显存。
- 主题不会自动修改、上传或转换管理员提供的模型文件。

版权
- 请仅使用你有权部署和公开展示的 Live2D 模型。
- 本主题 Release 默认不包含任何角色模型。
