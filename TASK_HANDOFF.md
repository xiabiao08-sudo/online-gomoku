# 在线联机五子棋任务交接

更新时间：2026-07-07

## 任务目标

实现可公网访问的网页好友房五子棋 MVP：创建房间、复制链接、两人进入、实时对弈、判胜、断线重连、再来一局、房间聊天。

## 当前状态

- React + Express + Socket.IO 单体服务已完成。
- 服务端默认监听 `0.0.0.0`，本地端口为 `8788`。
- 本机地址：`http://127.0.0.1:8788/`
- 同 Wi-Fi 地址会由 `/api/share-info` 和启动日志提供，形如 `http://192.168.x.x:8788/`。
- 固定公网地址：`https://online-gomoku-wjzw.onrender.com`
- Render 服务 ID：`srv-d9673u77f7vs73d271bg`
- GitHub 仓库：`https://github.com/xiabiao08-sudo/online-gomoku`
- 当前棋盘为 19 x 19，自由五子棋规则，黑棋先手。
- 已加入房间聊天，双方可发文字消息，最近保留 50 条。
- 已加入悔棋：最后落子方可申请悔棋，对方同意后撤回最后一手。
- 已加入重开：任意一方可请求重开，双方同意后清空棋盘重新开始。
- 棋盘线条按 `BOARD_SIZE` 动态计算，避免 15 路样式套到 19 路棋盘。
- 临时公网隧道可用于演示，但 `trycloudflare.com` 链接不能固定。稳定链接需要正式部署或 Cloudflare Named Tunnel + 自有域名。

## 核心路径

- 项目根：`projects/【codex test】/在线联机五子棋/`
- 前端源码：`src/`
- 服务端源码：`server/`
- 共享规则：`src/shared/game.ts`
- 单元/集成测试：`tests/`
- 浏览器测试：`e2e/`
- 公网部署说明：`DEPLOYMENT.md`
- 复盘与复用模板：`docs/retrospectives/`
- 复用 Skill：`.claude/skills/realtime-web-game-mvp/`

## 常用命令

```powershell
npm install
npm run test
npm run build
npm run test:e2e
npm run preview
npm start
```

## 验收标准

- 两个浏览器窗口能进入同一房间并实时对弈。
- 横、竖、斜向五连判胜正确。
- 刷新后可恢复原玩家身份。
- 双方可以互相发送聊天消息。
- 最后落子方申请悔棋后，对方同意可以撤回最后一手。
- 双方同意重开后，棋盘清空并由黑棋重新先手。
- 手机 360px 宽度下棋盘可见，按钮和输入框触控区域不小于 48 x 48 CSS px。
- `npm run test` 和 `npm run build` 通过。

## 风险点

- `projects/` 目录可能被 git ignore，提交时需要按实际情况 `git add -f`。
- MVP 房间状态只在内存中，服务重启会丢局。
- WebSocket 部署平台必须支持长连接。
- 本地 LAN 地址只能给同一局域网设备访问；不同网络的朋友需要公网部署或公网隧道。
- Quick Tunnel 链接不稳定，不能作为固定网址。
- Render Free 计划可能冷启动，长时间没人访问后第一次打开会慢一些。
