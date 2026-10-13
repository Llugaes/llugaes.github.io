# Llugaes 的小屋

个人主页地址：[https://llugaes.github.io/](https://llugaes.github.io/)。游戏游记、影视、学习笔记、工具与日常，用一幅小屋作入口。

`docs/` 是完整静态网站，不需要安装依赖或编译。页面保留原画与分层角色动画，支持键盘、触摸、关闭、返回和系统低动态。电视静音播放 Steam 官方宣传片，可单独控制，也可暂停所有背景动作。

## 本地预览

在仓库根目录启动任一静态文件服务器，例如：

```sh
python -m http.server 8000 --directory docs
```

浏览器打开 `http://localhost:8000/`。

## 内容维护

游戏房读取现有公开[游戏游记](https://llugaes.github.io/game-journal/)，最近三篇按有文字的评测发表日期或随笔日期排列，直接链接原文。联网失败时使用明确标记的缓存或离线快照，不复制评测正文。

`docs/site-content.json` 维护其他房间。工具包含现有[中日双语 MOD](https://github.com/Llugaes/bilingual-sora-2nd)；影视、学习笔记和日常目前为空。

条目需要唯一 `id` 和 `title`；可加入 `date`、`description`、本地 `cover`。`url` 链接已有原文，`body` 字符串数组用于简单纯文本笔记，支持列表、详情和返回。没有 CMS、服务器写入或账号系统。添加条目后也应同步 `docs/index.html` 中供无 JavaScript 使用的静态房间内容。

## 发布与恢复

GitHub Pages 的发布来源设置为 `main` 分支的 `/docs`。`docs/.nojekyll` 禁用 Jekyll 构建，直接发布已有静态产物。本仓库没有自定义 Actions 工作流；GitHub 负责内置 Pages 构建与部署。[官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

推送到发布分支会更新主页。需要恢复时，从历史提交恢复 `docs/`，创建新的恢复提交并推送到 `main`；保留提交历史，不强制改写分支。

图像与播放器的版权、出处见 [SOURCES.md](SOURCES.md)。官方游戏图像仍由原权利人持有，本仓库不授予额外使用许可。
