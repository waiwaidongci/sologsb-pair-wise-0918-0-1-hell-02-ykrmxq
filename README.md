# 钟表稳定性预警台

零依赖 Node 服务，使用 `data/db.json` 持久化钟表档案、调校记录、复测记录与**振幅稳定性预警**，并内置一个可直接打开的预警台页面。

## 启动

```bash
PORT=3021 node server.js
# 打开 http://127.0.0.1:3021
```

## 预警规则

- **生成**：写入复测时，与同一调校周期（同 `adjustmentId`）内时间最近的上一次复测比较；最新复测振幅比前一次**下降超过 20°**（严格大于，正好 20° 不触发）即生成一条 `open` 未确认预警。
- **确认**：每条预警只能确认一次（必填处理人）；重复确认返回 `409`。
- **清除与重新监测**：写入新调校后，该钟表所有当期（未确认/已确认）预警立即置为 `cleared`，从新调校周期重新监测；旧预警完整保留，可在历史中查询。
- **跨周期不比较**：新调校后的首次复测只作为基准，不与上一周期复测比较。
- **结论一致**：列表、钟表历史、汇总计数均由服务端同一份数据实时派生；页面每 15 秒自动轮询，等待时长每秒更新。

## 页面功能

打开首页可见预警列表：未确认预警置顶并显示实时等待时长；可填写处理人确认、按状态/钟表编号/处理人关键字筛选、点击钟表查看历史时间线（含录入复测、写入新调校）。

## 接口

原有接口保持不变，新增：

- `GET /warnings?status=current|open|confirmed|cleared|all&clockId=&q=` — 预警列表与计数
- `POST /warnings/:id/confirm` — `{ "handler": "姓名", "note": "可选" }`，重复确认返回 409

原有接口：

- `GET /health`
- `GET /clocks` / `POST /clocks`
- `GET /clocks/not-qualified`
- `GET /clocks/:id/history`（响应中额外包含 `warnings` 与钟表预警计数）
- `POST /clocks/:id/adjustments`（响应中额外返回 `clearedWarningIds`）
- `POST /clocks/:id/retests`（响应中额外返回 `previousRetest` 与生成的 `warning`）
- `GET /clocks/:id/latest-retest`
- `GET /adjustments?clockId=` / `GET /retests?clockId=&qualified=`

接口同时支持 `/api` 前缀（如 `GET /api/warnings`）。

## 闭环示例

```bash
# 首次复测（基准）+ 第二次复测振幅下降 21° -> 自动生成未确认预警
curl -X POST http://127.0.0.1:3021/clocks/clock_demo/retests \
  -H 'Content-Type: application/json' \
  -d '{"dailyRateSeconds":25,"amplitude":198}'

# 查看待确认预警（按等待时间置顶）
curl 'http://127.0.0.1:3021/warnings?status=open'

# 处理人确认（只能一次）
curl -X POST http://127.0.0.1:3021/warnings/<warningId>/confirm \
  -H 'Content-Type: application/json' -d '{"handler":"周师傅","note":"已检查发条盒"}'

# 写入新调校 -> 当期预警立即清除并重新监测（旧预警在 status=cleared 可查）
curl -X POST http://127.0.0.1:3021/clocks/clock_demo/adjustments \
  -H 'Content-Type: application/json' \
  -d '{"currentDailyRateSeconds":25,"direction":"慢针方向","amount":"游丝快慢针向慢侧微调0.4格"}'
```
