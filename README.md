# 棋者弈也

**好友五子棋 · ONLINE GOMOKU**

一个面向朋友之间快速开局的 19×19 在线五子棋。无需注册：创建棋局、分享链接、两名棋手对弈，后来者进入观众席。

**在线试玩：** [https://online-gomoku-wjzw.onrender.com/](https://online-gomoku-wjzw.onrender.com/)

**服务状态：** [健康检查](https://online-gomoku-wjzw.onrender.com/health)

## V1 功能

- 19×19 自由五子棋，无禁手
- 五子或以上立即获胜，满盘无胜者判和
- 第一局由服务端随机分配黑白
- 后续每局自动交换黑白
- 移动端默认启用“预览后确认”，设置保存在当前设备
- 5×5 落子放大预览
- 棋盘按钮缩放、双指缩放、放大后单指拖动
- 最多 5 名观众；观众可以看棋和实时聊天
- 新加入、刷新或重连后不补发历史聊天
- 悔棋只撤回最新一颗，需要对方同意；胜负后不能悔棋
- 棋手断线后暂停，等待原棋手恢复；观众不会补位
- 两名棋手都明确离开后立即关闭房间
- Render 单服务部署：网页与 Socket.IO 实时服务使用同一公网地址

## 本地开发

要求 Node.js 22.12 或更高版本。

```bash
npm ci
```

终端一：

```bash
npm run dev:api
```

终端二：

```bash
npm run dev:web
```

打开 `http://localhost:5173`。

默认本地前端连接 `http://localhost:8788`；也可以复制环境变量示例：

```bash
cp .env.frontend.example .env.local
cp .env.backend.example .env
```

## 检查

```bash
npm run typecheck
npm test
npm run build
```

一次运行全部检查：

```bash
npm run check
```

## Render 部署

仓库根目录的 `render.yaml` 会创建两个服务：

- `qizheyiy-gomoku-web`：Render Static Site
- `qizheyiy-gomoku-api`：Render Free Web Service

详细步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 重要限制

- 房间与棋局仅保存在后端进程内存中。
- 后端重启、重新部署或休眠恢复导致进程重建时，旧房间会消失。
- 当前限制为单个后端实例；没有账号、数据库、匹配、排行或永久战绩。
- 免费后端冷启动时，静态前端仍可打开并显示连接状态。

## 产品与技术规格

完整规格位于 [`docs/spec-v1`](./docs/spec-v1/README.md)。

效果图位于 [`docs/previews`](./docs/previews)。
