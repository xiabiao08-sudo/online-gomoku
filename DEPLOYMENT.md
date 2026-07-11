# Render 前后端拆分部署

## 架构

```text
Render Static Site
qizheyiy-gomoku-web
  └─ React / Vite / SPA

Render Free Web Service
qizheyiy-gomoku-api
  └─ Express / Socket.IO / 内存房间
```

前端独立由 CDN 提供，因此后端休眠时页面仍能打开，并显示“正在连接游戏服务器”。

## 推荐：Blueprint 部署

1. 将项目提交到 GitHub 仓库根目录。
2. 在 Render 选择 **New → Blueprint**。
3. 选择该 GitHub 仓库。
4. Render 读取根目录的 `render.yaml`。
5. 确认创建以下服务：
   - `qizheyiy-gomoku-web`
   - `qizheyiy-gomoku-api`
6. 完成首次部署后检查：
   - 前端首页可以打开
   - 后端 `/health` 返回 HTTP 200
   - 前端连接状态变为“游戏服务器已连接”

## Blueprint 核心配置

```yaml
services:
  - type: web
    name: qizheyiy-gomoku-api
    runtime: node
    plan: free
    buildCommand: npm ci && npm run typecheck && npm run test
    startCommand: npm start
    healthCheckPath: /health
    numInstances: 1

  - type: web
    name: qizheyiy-gomoku-web
    runtime: static
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

Blueprint 会把后端的 `RENDER_EXTERNAL_URL` 注入前端的 `VITE_SOCKET_URL`，并把前端 URL 注入后端的 `FRONTEND_ORIGINS`。

## 手动部署时的环境变量

### 前端

```env
VITE_SOCKET_URL=https://你的后端服务.onrender.com
```

### 后端

```env
HOST=0.0.0.0
NODE_ENV=production
FRONTEND_ORIGINS=https://你的前端服务.onrender.com
```

多个允许来源用英文逗号分隔。

## 健康检查

```text
GET /health
GET /api/health
```

正常响应示例：

```json
{"ok":true,"service":"qizheyiy-gomoku-api"}
```

## SPA 路由

静态站点必须保留以下 Rewrite：

```text
/* → /index.html
```

否则直接打开或刷新 `/room/ABC123` 会返回 404。

## 发布后验证

1. 用浏览器 A 创建棋局。
2. 用浏览器 B 加入，确认首局黑白为随机分配。
3. 用第三个浏览器加入，确认进入观众席。
4. 连续加入到 5 名观众，再加入第 6 名，确认显示观众席已满。
5. 测试手机端候选落子、确认开关、双指缩放和拖动。
6. 完成一局，确认获胜印章、获胜连线和再来一局换色。
7. 刷新观众页面，确认旧聊天不会补发。
8. 两名棋手依次点击离开，确认房间关闭。
