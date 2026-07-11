# 验证记录

## 已通过

- `npm run typecheck`
- `npm test`：23/23
- `npm run build`
- `npm audit`：0 vulnerabilities
- 后端本地启动
- `GET /health`：HTTP 200
- `render.yaml`：YAML 语法解析通过

## 浏览器端到端测试

Playwright 测试脚本已经按最终界面更新，覆盖：

- 双人加入与首局随机黑白
- 候选落子与确认
- 观众加入和聊天
- 五连胜负
- 再来一局后交换黑白

当前执行环境没有安装 Playwright Chromium 二进制，因此未在此环境实际完成浏览器运行。部署前执行：

```bash
npx playwright install chromium
npm run test:e2e
```
