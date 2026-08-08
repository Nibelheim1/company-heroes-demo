# 同花顺英雄 · Company Heroes

这是完整版的移动端 H5 游戏：将 A 股公司拟人化，用户通过经营人格测试匹配契合英雄，再组建 3—5 人战队与好友进行盲选 PK。

## 在线体验

如果仓库已开启 GitHub Pages，可访问：

https://nibelheim1.github.io/company-heroes-demo/

根目录已经放置可直接部署的静态构建产物，包括 320 位英雄数据、320 张主立绘和 320 张缩略图。

## 本地开发

完整版源码位于 `full-h5/`。运行方式：

```bash
cd full-h5
npm install
npm run dev
```

校验与构建：

```bash
npm test
npm run build
```

## 玩法闭环

- 16 道经营场景题，每题 3 个选项，点击后自动进入下一题
- 8 维经营人格、主契合英雄和 Top 5 匹配
- 320 位英雄搜索、筛选和详细档案
- 3—5 人组队、好友盲选、5 日 PK 演示
- 团队化学反应、优势、盲点和分享文案

当前 PK 分数为确定性模拟分，仅用于演示交互。正式上线时应接入合规授权行情源，并继续保留非投资建议提示。

## 腾讯云 CloudBase 静态托管

仓库根目录的 `dist/` 已经是可直接托管的生产包，必须保留 `assets/`、`data/`、`heroes/` 和 `heroes/thumb/` 子目录。使用 CloudBase CLI 时，从仓库根目录执行：

```bash
tcb hosting deploy ./dist /ths -e YOUR_ENV_ID
```

将静态站点默认文档设置为 `index.html`，访问时使用托管域名下的 `/ths/` 路径。不要上传 `full-h5/src/styles.css` 或只上传 `index.html`。
