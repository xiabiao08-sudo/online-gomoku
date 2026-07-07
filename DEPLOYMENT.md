# 公网部署说明

这个项目是 React + Express + Socket.IO 的单体 Node Web 服务。公网演示版必须部署成支持 WebSocket 的 Node 服务，不能只部署成纯静态站点，否则实时联机会失效。

## 为什么临时链接会打不开

`trycloudflare.com` Quick Tunnel 是临时隧道，适合快速演示：

- 电脑关机、网络变化、隧道进程退出后，链接会失效。
- 每次重启隧道通常会得到新的链接。
- 它不能作为长期固定网址。

想让朋友稳定打开，有两类方案：

- 正式部署到支持 Node + WebSocket 的平台，例如 Render、Railway、Fly.io 或 VPS。
- 使用 Cloudflare Named Tunnel + 自有域名，把固定域名指向本机或服务器。

## 推荐方案 A：Node Web Service

适合长期给朋友分享一个公网 HTTPS 链接。

项目已提供两个可复用配置文件：

- `render.yaml`：Render Blueprint / Web Service 配置参考。
- `railway.json`：Railway Nixpacks 构建与启动配置参考。

Render / Railway / Fly.io / VPS 的核心配置类似：

- Root Directory：`projects/【codex test】/在线联机五子棋`
- Environment：`Node`
- Build Command：`npm ci && npm run build`
- Start Command：`npm start`
- Health Check Path：`/health`
- Instance Count：`1`

一般不需要手动设置 `PORT`，部署平台会自动注入。可选环境变量：

```text
HOST=0.0.0.0
```

部署完成后检查：

```text
https://<你的公网域名>/health
```

应返回：

```json
{"ok":true}
```

然后用两台不同网络的设备打开同一个房间链接，确认双方能加入、落子、聊天。

## 推荐方案 B：Cloudflare Named Tunnel

适合你已经有自有域名，且希望把固定域名转发到本机或某台服务器。

关键点：

- 使用 Named Tunnel，不使用 Quick Tunnel。
- 域名 DNS 由 Cloudflare 托管。
- 隧道服务要常驻运行。
- 转发目标指向本服务，例如 `http://127.0.0.1:8788`。

## 重要限制

- MVP 房间状态存在服务端内存里，服务重启会丢房间。
- 当前版本应部署单实例，多实例需要 Socket.IO Redis Adapter 和共享房间状态。
- 平台休眠后第一次打开可能较慢，已创建的内存房间也可能丢失。
- 纯静态托管不适合这个项目，必须支持 Node 服务和 WebSocket。
