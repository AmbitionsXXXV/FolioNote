# Cloudflare 部署检查清单（Web + Server）

本文档聚焦 Folio 的 Cloudflare 部署中最常见的配置问题，尤其是 Web 访问 Server 时的跨域（CORS）与 Cookie（Credentials）场景。

## 1. 核心概念：CORS 的 Origin 是“精确字符串”

浏览器的 `Origin` 请求头是 **scheme + host (+ port)**，例如：

```text
https://folio-web.yilonglei790.workers.dev
```

它 **不包含路径**，也 **不包含末尾的 `/`**。

当 `server` 端启用 `credentials: true` 时：

1. `Access-Control-Allow-Origin` **不能**是 `*`；
2. `Access-Control-Allow-Origin` 必须与请求的 `Origin` **完全一致**（哪怕多一个 `/` 都会被浏览器判定为跨域失败）。

## 2. Server（Cloudflare Workers）必填环境变量

在 Cloudflare Workers（`folio-server`）的生产环境里，至少需要配置：

1. `CORS_ORIGIN`
2. `BETTER_AUTH_URL`

推荐值（注意都 **不要**带末尾 `/`）：

```text
CORS_ORIGIN=https://folio-web.yilonglei790.workers.dev
BETTER_AUTH_URL=https://folio-server.yilonglei790.workers.dev
```

## 3. Web（Cloudflare Pages）环境变量

在 Cloudflare Pages（`folio-web`）的生产环境里，确保：

```text
VITE_SERVER_URL=https://folio-server.yilonglei790.workers.dev
VITE_WEB_URL=https://folio-web.yilonglei790.workers.dev
```

## 4. 一条命令验证 CORS 是否正确

在本机执行以下命令，模拟浏览器的预检请求（Preflight）：

```bash
curl -i -X OPTIONS 'https://folio-server.yilonglei790.workers.dev/rpc' \
  -H 'Origin: https://folio-web.yilonglei790.workers.dev' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

期望响应头包含：

1. `access-control-allow-origin: https://folio-web.yilonglei790.workers.dev`
2. `access-control-allow-credentials: true`

如果缺少第 1 条，优先检查：

1. `CORS_ORIGIN` 是否带了末尾 `/`；
2. 是否把变量配在了错误的环境（例如 preview）或错误的服务（Pages vs Workers）。


