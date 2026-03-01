# API Relay

通用 Vercel Serverless API 转发服务。让内网机器通过 `*.vercel.app` 访问任意被防火墙拦截的外部 API。

## 原理

```
内网服务器 → api-relay.vercel.app → 任意上游 API
              (防火墙放行)           (Vercel 出口无限制)
```

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

### 3. 在项目中使用

```bash
# .env
POLYMARKET_RELAY_URL=https://your-relay.vercel.app
POLYMARKET_RELAY_KEY=your-secret-key
```

## 安全

- 仅代理 `targets.json` 和 `RELAY_EXTRA_TARGETS` 中声明的上游，不支持任意 URL
- `RELAY_API_KEY` 通过 Vercel 环境变量配置，不提交到代码仓库
- 支持转发 `Authorization` header，适用于需要认证的上游 API
- 支持 GET / POST / PUT / DELETE 全方法
