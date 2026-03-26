# GPU Monitoring Dashboard

这是一个 Grafana GPU 监控面板（JSON），用于直观看到：

- 每个 node 上每张 GPU 的**当前利用率**
- 每个 node 上每张 GPU 的**历史趋势**
- 当前时间范围内每张 GPU 的历史统计（Current / Min / Max / Mean）

## 文件

- `grafana-gpu-util-dashboard.json`

## 如何使用

1. 在 Grafana 中导入 `grafana-gpu-util-dashboard.json`
2. 选择 Prometheus 数据源（可指向你提供的地址）
   - Prometheus: `http://157.66.255.189:32003`
3. 在面板顶部使用筛选变量：
   - `IP`: 支持 `All` 或选择某个 IP
   - `Node`: 支持 `All` 或某个 node
   - `GPU`: 支持 `All` 或某张卡

## 关键视图

- `每节点每GPU当前利用率（即时）`：按 node/GPU 展示当前值
- `每机每卡 GPU 利用率趋势（含当前值与历史统计）`：折线 + 右侧统计
- `每机每卡 GPU Util 汇总表（当前值 + 历史状态）`：表格查看 Current/Min/Max/Mean

## 指标来源

面板默认使用以下 DCGM 指标：

- `DCGM_FI_DEV_GPU_UTIL`
- `DCGM_FI_DEV_FB_USED`
- `DCGM_FI_DEV_FB_FREE`
