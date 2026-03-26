# GPU Monitoring Dashboard (Grafana)

该仓库提供一个可直接导入 Grafana 的 GPU 监控面板：

- 顶部支持 `IP` 筛选（`All` 或单个 IP）
- 支持 `Node`、`GPU` 联动筛选
- 可直观看到**每个 Node 上每张 GPU 的当前值**（QPS 风格卡片）
- 同时展示**历史趋势数据**与**汇总统计**（Current / Min / Max / Mean）

---

## 文件

- `grafana-gpu-util-dashboard.json`：Grafana Dashboard 定义

---

## 快速使用

1. 打开 Grafana，进入 **Dashboards -> Import**
2. 上传 `grafana-gpu-util-dashboard.json`
3. 选择 Prometheus 数据源（类型为 Prometheus）
4. 保存 Dashboard

---

## Prometheus 测试地址

你可以使用以下 Prometheus 地址作为数据源进行测试：

- `http://157.66.255.189:32003`

在 Grafana 中创建/编辑 Prometheus Data Source 时：

- URL 填写：`http://157.66.255.189:32003`
- Access 推荐：`Server`（默认）

---

## 面板说明（与需求对应）

1. **QPS 风格当前值**
   - 面板：`每机每卡 GPU 利用率当前值（QPS 风格）`
   - 展示每个节点每张 GPU 的当前利用率，并带 sparkline 小趋势

2. **每机每卡历史趋势**
   - 面板：`每机每卡 GPU 利用率趋势（含当前值与历史统计）`
   - 可在图例/表格看到每条序列的当前值和历史统计

3. **每机每卡汇总表**
   - 面板：`每机每卡 GPU Util 汇总表（当前值 + 历史状态）`
   - 列出 Node / GPU / Current / Min / Max / Mean

4. **顶部筛选**
   - `IP`：支持 `All` 或单个 IP（从 `instance` 标签提取）
   - `Node`：跟随 IP 过滤
   - `GPU`：跟随 IP + Node 过滤
