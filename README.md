# Polymarket API Relay

Vercel Serverless 转发服务，让内网机器通过 `*.vercel.app` 访问 Polymarket API。

## 原理

```
内网 Linux 服务器 → polymarket-relay.vercel.app → gamma-api.polymarket.com
                    (防火墙放行 vercel.app)        (Vercel 出口无限制)
```

## 支持的 API

| Target | 上游地址 | 说明 |
|--------|---------|------|
| `gamma` | gamma-api.polymarket.com | 市场列表、价格、条件等 |
| `clob` | clob.polymarket.com | 订单簿、中间价 |
| `data` | data-api.polymarket.com | 交易记录、用户数据 |

## 用法

```bash
# 健康检查
curl https://your-relay.vercel.app/api/health

# 获取市场列表
curl "https://your-relay.vercel.app/api/proxy?target=gamma&path=/markets&limit=5"

# 查询中间价
curl "https://your-relay.vercel.app/api/proxy?target=clob&path=/midpoint&token_id=xxx"

# 查询用户交易
curl "https://your-relay.vercel.app/api/proxy?target=data&path=/trades&user=0x..."

# 带 API Key 认证
curl "https://your-relay.vercel.app/api/proxy?target=gamma&path=/markets&limit=5&key=your-key"
# 或通过 Header
curl -H "X-API-Key: your-key" "https://your-relay.vercel.app/api/proxy?target=gamma&path=/markets&limit=5"
```

## 部署

### 1. 关联 GitHub 仓库

Push 到 GitHub 后，在 [Vercel Dashboard](https://vercel.com/dashboard) 中 Import 该仓库即可自动部署。

### 2. 配置环境变量（可选）

在 Vercel Dashboard → Settings → Environment Variables 中设置：

| 变量 | 说明 |
|------|------|
| `RELAY_API_KEY` | API 访问密钥（不设则开放访问） |

### 3. 在 trading-system 中使用

```bash
# trading-system/.env
POLYMARKET_RELAY_URL=https://your-relay.vercel.app
POLYMARKET_RELAY_KEY=your-secret-key
```

## 安全

- `RELAY_API_KEY` 通过 Vercel 环境变量配置，不提交到代码仓库
- 仅代理 Polymarket 官方 API，不支持任意 URL 转发
- 生产环境建议开启 API Key 认证
