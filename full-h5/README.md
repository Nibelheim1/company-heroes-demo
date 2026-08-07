# 同花顺英雄 · 完整版 H5

一款将 A 股公司拟人化的移动端 H5 游戏。当前版本已经接入 320 位公司英雄、专属立绘、16 道经营人格题、个人匹配画像、3—5 人盲选组队、好友 PK 演示和团队画像。

## 本地运行

需要 Node.js 18 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址即可。

## 构建与校验

```bash
npm test
npm run build
```

静态产物生成在 `dist/`，可直接部署到腾讯云 CloudBase、GitHub Pages、Cloudflare Pages 等静态托管服务。Vite 已设置相对资源路径，子目录部署也可使用。

## 内容与资产

- `data/heroes.json`：320 位英雄的标准化数据
- `public/heroes/`：320 张主立绘 WebP
- `public/heroes/thumb/`：320 张列表缩略图 WebP
- `src/quiz-data.js`：16 道题，每题 3 个选项，覆盖 8 个经营人格维度
- `src/profile-engine.js`：个人匹配与团队画像引擎
- `data/asset-report.json`：数据、图片和映射完整性报告

若源 TSV 或立绘更新，运行：

```bash
python scripts/normalize-assets.py
```

随后重新执行 `npm test` 与 `npm run build`。

## 行情接入说明

当前 PK 分数是确定性模拟数据，用于展示完整交互。正式上线时应在服务端接入有授权的行情源，按双方每日收盘涨跌幅等权计算，并处理停牌、退市、涨跌停、成分变更和数据延迟。前端已在所有关键页面明确标注：契合度与 PK 结果不构成投资建议，也不预测收益。

