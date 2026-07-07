# 实时网页小游戏 MVP 复用模板

适用范围：棋类、牌类、回合制对战、猜词、画图猜谜、轻量派对游戏等需要好友房和实时同步的网页小游戏。

## 1. 产品决策模板

先回答这些问题，再写代码：

- 游戏类型：棋类 / 牌类 / 回合制 / 即时动作 / 派对小游戏。
- 玩家数量：固定 2 人，还是 2 到 N 人。
- 进入方式：好友房链接 / 房间号 / 匹配。
- 身份方式：不登录昵称 / 临时 token / 账号。
- 状态保存：内存 / 数据库 / Redis。
- 联机方式：Socket.IO / WebRTC / 轮询。
- MVP 非目标：账号、排行榜、聊天、观战、AI、付费、皮肤是否先砍掉。

默认推荐：

- 好友房链接。
- 不登录，昵称进入。
- 本地 token 恢复身份。
- Node + Express + Socket.IO。
- 单体服务同时托管前端和后端。
- MVP 内存状态，公网部署单实例。

## 2. 标准项目结构

```text
<game-project>/
  package.json
  README.md
  DEPLOYMENT.md
  TASK_HANDOFF.md
  server/
    index.ts
    roomStore.ts
    socketHandlers.ts
  src/
    shared/
      game.ts
    client/
      socketClient.ts
      storage.ts
    components/
      HomePage.tsx
      RoomPage.tsx
      Board.tsx 或 GameSurface.tsx
      PlayerPanel.tsx
      StatusMessage.tsx
    App.tsx
    main.tsx
    styles.css
  tests/
    game.test.ts
    roomStore.test.ts
    socket.test.ts
  e2e/
    game.spec.ts
```

## 3. 服务端状态机

建议抽象：

```text
Room {
  id
  players
  status: waiting | playing | finished
  turn
  gameState
  lastAction
  winner
  restartReady
  createdAt
  updatedAt
}
```

通用校验顺序：

1. 房间存在。
2. 玩家 token 有效。
3. 玩家属于该房间。
4. 房间处于可操作状态。
5. 玩家在线。
6. 轮到该玩家或该动作允许非回合玩家执行。
7. 动作参数合法。
8. 动作不会违反规则。
9. 写入状态。
10. 广播完整公共状态。

## 4. Socket 事件模板

```text
room:create
room:join
room:state
game:action
game:restartReady
player:leave
```

建议所有客户端请求使用 ack：

```ts
{ ok: true, room, playerToken?, color? }
{ ok: false, error }
```

不要依赖前端自己推演结果。前端发送动作后等待服务端广播的完整状态。

## 5. 前端 UI 模板

首页只放最短路径：

- 昵称输入。
- 创建房间。
- 房间号加入。

房间页必须包含：

- 主游戏区域。
- 玩家面板。
- 当前状态。
- 房间号和复制链接。
- 结束与再开一局入口。

移动端优先保证主游戏区域可点。说明文字、装饰、状态栏不能挤压或遮挡主操作区域。

## 6. 分享与部署模板

必须区分三种地址：

- `127.0.0.1` / `localhost`：只给本机。
- `192.168.x.x` / `10.x.x.x`：只给同一局域网。
- `https://...` 公网域名：给异地朋友。

MVP 部署建议：

- `npm run build`
- `npm start`
- `/health`
- 单实例 Node Web Service
- 支持 WebSocket 的平台

临时试玩可以用 Cloudflare Tunnel。长期演示用 Render/Railway/Fly.io/VPS。

## 7. 验收清单

功能：

- 两个浏览器能进入同一房间。
- 双方能实时看到状态变化。
- 非法动作不会改变状态。
- 结束条件正确。
- 刷新后能恢复身份。
- 再来一局流程可用。

视觉：

- 主操作坐标准确。
- 移动端可点。
- 状态提示不遮挡主区域。
- 文本不溢出。
- 键盘焦点清晰。
- 减少动态效果时仍可理解。

工程：

- `npm run check` 通过。
- `npm run test:e2e` 通过。
- `npm audit --omit=dev` 无生产漏洞。
- README、DEPLOYMENT、TASK_HANDOFF 更新。

## 8. 常见坑

- 只部署静态前端，导致 Socket.IO 后端不存在。
- 复制 `127.0.0.1` 给朋友。
- 多实例部署但状态存在内存，导致玩家被分到不同进程。
- 前端乐观更新和服务端状态冲突。
- 棋盘、格子、点击热区坐标不一致。
- E2E 只测单浏览器，没有测双客户端同步。
- 手机端按钮和棋盘太小。
