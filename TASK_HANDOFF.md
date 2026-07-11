# 最终交接

## 交付状态

该目录是“棋者弈也”V1 最终源码包，可直接提交到 GitHub 并通过根目录 `render.yaml` 创建前后端两个 Render 服务。

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

## 首次部署后重点检查

- Render 后端 `/health`
- 静态站点 `/room/:id` 刷新
- CORS 是否允许正式前端 URL
- 两个浏览器的随机分色
- 第三位用户的观众身份
- 第六位观众被拒绝
- 重开后的黑白交换
- 手机双指缩放与确认落子
- 刷新后聊天记录为空
- 双方明确离开后房间关闭

## 已知边界

房间状态保存在单个 Node.js 进程内。服务端重启会导致旧房间失效，这是 V1 已接受的产品边界。
