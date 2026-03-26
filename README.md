# GPU 监控面板

基于 React + Vite 的 Web 面板，从 **Prometheus** 读取 NVIDIA DCGM 指标 `DCGM_FI_DEV_GPU_UTIL`，按 **节点（node）** 分组展示每张 **GPU** 的：

- **当前利用率**（Prometheus instant query）
- **历史曲线**（`query_range`）及时间范围内的 **最小 / 最大 / 平均**

## 运行方式

```bash
cd gpu-monitor
npm install
npm run dev
```

浏览器打开终端里提示的本地地址即可。

开发时通过 Vite 代理访问 Prometheus，避免浏览器跨域。默认代理目标为 `http://157.66.255.189:32003`，可在启动前覆盖：

```bash
VITE_PROMETHEUS_PROXY_TARGET=http://你的-prom:9090 npm run dev
```

## 筛选说明

- **节点 IP**：对应指标标签 `instance` 的主机部分（`ip:port` 中的 IP），可选「全部」或某一 IP，用于只看某台 exporter 所在节点。
- **历史范围**：影响曲线与统计（低/高/均）。

## 生产部署

构建静态资源：

```bash
cd gpu-monitor
npm run build
```

将 `gpu-monitor/dist` 挂到任意静态服务器。若 Prometheus 与站点不同源，需配置 **CORS** 或同源反向代理；也可设置环境变量让前端直连（需目标允许跨域）：

```bash
VITE_PROMETHEUS_URL=https://your-proxy/prometheus npm run build
```

## 仓库内其他文件

- `grafana-gpu-util-dashboard.json`：Grafana 仪表板导出，可与本面板配合使用。
