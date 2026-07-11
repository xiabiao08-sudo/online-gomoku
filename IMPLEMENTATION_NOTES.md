# V1 最终实现说明

## 已落实的产品决策

- 正式名称：棋者弈也
- 副标题：好友五子棋 · ONLINE GOMOKU
- 19×19 自由规则
- 第一局随机黑白，后续自动换色
- 最多 5 名观众，不自动补位
- 观众可参与实时聊天
- 不存储或补发聊天历史
- 悔棋仅撤回最新一颗；双方同意后执行
- 胜负产生后禁用悔棋
- 满盘判和
- 明确离开与临时断线分离
- 两名棋手都明确离开后关闭房间
- 移动端确认设置持久化到 localStorage
- 前端静态站点、后端 Web Service 拆分

## 关键技术变化

- Socket.IO 配置了连接状态恢复与指数退避式客户端重连。
- 后端 CORS 仅允许 `FRONTEND_ORIGINS` 中的来源。
- 聊天改为独立 `chat:message` 实时事件，不进入房间快照。
- 服务器执行首局随机分色和再战换色。
- 棋盘支持 Pointer Events：单点选择、双指缩放、放大后拖动。
- 静态前端通过 `VITE_SOCKET_URL` 连接后端。
- Render Blueprint 创建两个服务并配置 SPA Rewrite。

## 已执行验证

```text
TypeScript：通过
Vitest：23/23 通过
Vite production build：通过
npm audit：0 vulnerabilities
```

## 未包含

- 数据库和 Redis
- 账号与永久战绩
- 自动匹配和排行榜
- AI 对战
- 内容举报或复杂管理后台
