# GPU 监控面板

本仓库提供一个可直接导入 Grafana 的 GPU 监控面板定义文件：

- `grafana-gpu-util-dashboard.json`

## 面板能力

- 顶部支持 `All / 某个 IP` 筛选
- 支持按 `Node IP -> Node -> GPU` 逐级过滤
- 直观看到每个节点上每张 GPU 的当前利用率
- 查看每个节点每张 GPU 的历史趋势
- 查看每张 GPU 的当前值、最小值、最大值、平均值
- 查看每张 GPU 的显存占用趋势与显存已用汇总

## 数据源

面板基于 Prometheus + NVIDIA DCGM Exporter 指标，核心使用如下指标：

- `DCGM_FI_DEV_GPU_UTIL`
- `DCGM_FI_DEV_FB_USED`
- `DCGM_FI_DEV_FB_FREE`
- `kube_node_info`（用于把 Node 映射到 `internal_ip`）

测试使用的 Prometheus 地址：

- `http://157.66.255.189:32003`

## 导入方式

1. 打开 Grafana
2. 进入 `Dashboards -> New -> Import`
3. 导入 `grafana-gpu-util-dashboard.json`
4. 将变量 `DS_PROMETHEUS` 绑定到你的 Prometheus 数据源
5. 保存仪表盘

## 顶部筛选说明

- `Node IP`: 查看全部 GPU 节点，或者只查看某个 IP
- `Node`: 在当前 IP 范围内继续筛选具体节点
- `GPU`: 在当前节点范围内继续筛选具体 GPU 编号

如果选择某个 `Node IP`，下面所有图表都会联动，只展示该机器上的 GPU 当前值与历史数据。

## 主要面板说明

- `在线 GPU 节点数`：当前筛选范围内在线的 GPU 节点数量
- `在线 GPU 数`：当前筛选范围内在线的 GPU 总数
- `每个 Node / GPU 当前利用率`：最直观查看每台机器每张卡当前值
- `每个 Node / GPU 的 GPU 利用率趋势`：查看所有卡的历史趋势
- `每个 Node / GPU GPU Util 汇总表`：查看 Current / Min / Max / Mean
- `节点 $node：每张 GPU 当前利用率`：按节点拆分查看该机器上每张卡的实时值
- `节点 $node：每张 GPU 历史利用率趋势`：按节点拆分查看每张 GPU 的历史数据
