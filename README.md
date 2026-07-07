# 在线联机五子棋

网页好友房五子棋 MVP。用户不登录，输入昵称后创建或加入房间，双方通过 Socket.IO 实时对弈。

## 当前功能

- 19 x 19 自由五子棋，黑白双方五连即胜，不做禁手。
- 好友房：创建房间、复制房间号或链接、两人进入后开局。
- 服务端权威判定落子、轮次、胜负和再来一局。
- 刷新后使用本地 token 恢复身份。
- 房间聊天：双方可发送文字消息，最近保留 50 条。
- 本地、局域网、临时公网隧道、正式公网部署分开处理。

## 常用命令

```powershell
npm install
npm run test
npm run build
npm run preview
npm run test:e2e
```

## 本地运行

```powershell
npm run build
npm run preview
```

本机打开：

```text
http://127.0.0.1:8788/
```

同一 Wi-Fi / 局域网内分享时，启动日志会打印类似：

```text
LAN share URL: http://192.168.x.x:8788
```

把页面显示的 `http://192.168.x.x:8788/room/<房间号>` 分享给同一局域网里的朋友。不要分享 `127.0.0.1` 或 `localhost` 开头的链接，它们只代表每个人自己的设备。

如果朋友不在同一个 Wi-Fi / 局域网，必须使用公网部署或公网隧道。临时 Cloudflare Quick Tunnel 链接可以演示，但链接会变，不能保证长期可用。稳定方案见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 固定公网演示

Render Web Service 已部署：

```text
https://online-gomoku-wjzw.onrender.com
```

健康检查：

```text
https://online-gomoku-wjzw.onrender.com/health
```

## 项目入口

- 公网部署说明：[DEPLOYMENT.md](DEPLOYMENT.md)
- 任务交接：[TASK_HANDOFF.md](TASK_HANDOFF.md)
- 项目复盘：[docs/retrospectives/2026-07-06-online-gomoku-retrospective.md](docs/retrospectives/2026-07-06-online-gomoku-retrospective.md)
- 小游戏 MVP 复用模板：[docs/retrospectives/GAME_MVP_PLAYBOOK.md](docs/retrospectives/GAME_MVP_PLAYBOOK.md)

## 非目标

当前版本不做账号、排行榜、观战、悔棋、计时、AI、随机匹配或数据库持久化。房间状态存在服务端内存中，服务重启后会丢失。
