# 当前交接

## 交付状态

该目录是“棋者弈也”V1 最新源码。Render 使用单个 Express + Socket.IO 服务同时托管网页和实时对局。

公网地址：<https://online-gomoku-wjzw.onrender.com/>

手机端棋盘规则与迁移步骤：[`docs/standards/MOBILE_INTERACTION_MIGRATION.md`](./docs/standards/MOBILE_INTERACTION_MIGRATION.md)。

## 发布前必须做

```bash
npm ci
npm run check
```

然后提交：

```bash
git add .
git commit -m "feat: release 棋者弈也 v1"
git push origin main
```

## 部署后重点检查

- Render 后端 `/health`
- 静态站点 `/room/:id` 刷新
- 同源 Socket.IO 连接是否成功
- 两个浏览器的随机分色
- 第三位用户的观众身份
- 第六位观众被拒绝
- 重开后的黑白交换
- 手机棋盘首屏完整显示、未缩放时上下滑动、缩放后单指拖动
- 刷新后聊天记录为空
- 双方明确离开后房间关闭

## 已知边界

房间状态保存在单个 Node.js 进程内。服务端重启会导致旧房间失效，这是 V1 已接受的产品边界。
