# API Relay

通用 Vercel Serverless API 转发服务。让内网机器通过 `*.vercel.app` 访问被防火墙拦截的外部 HTTP API，或访问外部常驻 sidecar 的 HTTP control plane。

## 原理

```
内网服务器 → api-relay.vercel.app → HTTP 上游 / truth sidecar
              (防火墙放行)           (Vercel 出口放行)
```

注意：

- `api-relay` 只转发 HTTP。
- 它不是 websocket carrier。
- 对 `trading-system` 来说，Polymarket market websocket 应由外部 `truth sidecar` 常驻进程维护，relay 只负责转发 `health / events / reconcile` 这些 HTTP 接口。

## 添加新的上游服务

编辑 `targets.json`，添加一行：

```json
{
  "gamma":     "https://gamma-api.polymarket.com",
  "coingecko": "https://api.coingecko.com/api/v3",
  "binance":   "https://api.binance.com",
  "your-api":  "https://api.your-service.com"
}
```

推送到 GitHub → Vercel 自动部署 → 立即生效。

如果不想重新部署，也可以通过 Vercel 环境变量 `RELAY_EXTRA_TARGETS` 动态添加：

```
RELAY_EXTRA_TARGETS={"newapi":"https://api.newservice.com"}
```

Phase 10 起，`trading-system` 还支持通过环境变量直接注册 `shadow_sidecar`：

```bash
SHADOW_SIDECAR_URL=https://your-sidecar.example.com
SHADOW_SIDECAR_TOKEN=your-sidecar-bearer-token
```

启用后，relay 会把：

- `GET /api/proxy?target=shadow_sidecar&path=/v1/health`
- `GET /api/proxy?target=shadow_sidecar&path=/v1/events`
- `POST /api/proxy?target=shadow_sidecar&path=/v1/subscriptions/reconcile`

透明转发到 sidecar，并自动注入 `Authorization: Bearer <SHADOW_SIDECAR_TOKEN>`。

## 用法

```bash
# 健康检查（查看所有可用 target）
curl https://your-relay.vercel.app/api/health

# Polymarket 市场列表
curl "https://your-relay.vercel.app/api/proxy?target=gamma&path=/markets&limit=5"

# CoinGecko 比特币价格
curl "https://your-relay.vercel.app/api/proxy?target=coingecko&path=/simple/price&ids=bitcoin&vs_currencies=usd"

# Binance 行情
curl "https://your-relay.vercel.app/api/proxy?target=binance&path=/api/v3/ticker/price&symbol=BTCUSDT"

# 带 API Key 认证
curl -H "X-API-Key: your-key" "https://your-relay.vercel.app/api/proxy?target=gamma&path=/markets&limit=5"
```

## 部署

### 1. 关联 GitHub

Push 到 GitHub 后，在 [Vercel Dashboard](https://vercel.com/dashboard) 中 Import 该仓库，自动部署。

### 2. 环境变量（Vercel Dashboard → Settings → Environment Variables）

| 变量 | 必需 | 说明 |
|------|------|------|
| `RELAY_API_KEY` | 否 | API 访问密钥（不设则开放访问） |
| `RELAY_EXTRA_TARGETS` | 否 | 运行时追加 target（JSON 格式） |
| `SHADOW_SIDECAR_URL` | 否 | Phase 10 truth sidecar 的 HTTP 基地址 |
| `SHADOW_SIDECAR_TOKEN` | 否 | relay 转发到 truth sidecar 时注入的 Bearer token |

### 3. 在项目中使用

```bash
# .env
POLYMARKET_RELAY_URL=https://your-relay.vercel.app
POLYMARKET_RELAY_KEY=your-secret-key
TRUTH_SIDECAR_URL=https://your-sidecar.example.com
TRUTH_SIDECAR_TOKEN=your-sidecar-bearer-token
```

## 安全

- 仅代理 `targets.json` 和 `RELAY_EXTRA_TARGETS` 中声明的上游，不支持任意 URL
- `RELAY_API_KEY` 通过 Vercel 环境变量配置，不提交到代码仓库
- 支持转发 `Authorization` header，适用于需要认证的上游 API
- 支持 GET / POST / PUT / DELETE 全方法
