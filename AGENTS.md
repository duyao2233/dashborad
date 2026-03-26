# AGENTS.md

## Overview

This repository contains a single Grafana dashboard JSON definition (`grafana-gpu-util-dashboard.json`) for monitoring AI/ML GPU utilization across a Kubernetes cluster using NVIDIA DCGM Exporter metrics via Prometheus. There is no application code, build system, or package manager.

## Cursor Cloud specific instructions

### What this repo contains

- `grafana-gpu-util-dashboard.json` — Exported Grafana dashboard (requires Grafana >= 10.4.0, Prometheus datasource)
- Panel titles are in Chinese; the dashboard is titled "AI GPU Util Monitoring (Dynamic Nodes)"
- Dashboard variables: `Node` (multi-select) and `GPU` (multi-select) for filtering
- Metrics used: `DCGM_FI_DEV_GPU_UTIL`, `DCGM_FI_DEV_FB_USED`, `DCGM_FI_DEV_FB_FREE`

### Running the dashboard locally

Docker is required. A mock metrics stack can be started from `/tmp/grafana-dev/`:

```bash
# Start all services (mock DCGM metrics generator, Prometheus, Grafana)
sudo dockerd &>/tmp/dockerd.log &
sleep 3
docker compose -f /tmp/grafana-dev/docker-compose.yml up -d --build
```

Services:
| Service | Port | Purpose |
|---------|------|---------|
| Mock DCGM Metrics | 9400 | Python HTTP server generating fake GPU metrics for 3 nodes x 4 GPUs |
| Prometheus | 9090 | Scrapes mock metrics every 5s |
| Grafana | 3000 | Dashboard UI (anonymous admin access, no login needed) |

After containers start, add the Prometheus datasource and import the dashboard:

```bash
# Add Prometheus datasource
DS_UID=$(curl -s -X POST http://localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{"name":"Prometheus","type":"prometheus","url":"http://prometheus:9090","access":"proxy","isDefault":true}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['datasource']['uid'])")

# Import dashboard (replace DS_PROMETHEUS variable with actual UID)
python3 -c "
import json
with open('/workspace/grafana-gpu-util-dashboard.json') as f:
    d = json.load(f)
d.pop('__inputs', None); d.pop('__requires', None); d['id'] = None
def fix(o):
    if isinstance(o, dict):
        for k,v in o.items():
            if isinstance(v, str) and '\${DS_PROMETHEUS}' in v: o[k] = v.replace('\${DS_PROMETHEUS}', '$DS_UID')
            else: fix(v)
    elif isinstance(o, list):
        for i in o: fix(i)
fix(d)
print(json.dumps({'dashboard': d, 'overwrite': True, 'folderId': 0}))
" | curl -s -X POST http://localhost:3000/api/dashboards/db -H 'Content-Type: application/json' -d @-
```

Dashboard URL: `http://localhost:3000/d/ai-gpu-util-dynamic/ai-gpu-util-monitoring-dynamic-nodes`

### Gotchas

- The Docker daemon may need to be started manually (`sudo dockerd`) in the cloud VM since there is no systemd.
- The `fuse-overlayfs` storage driver and `iptables-legacy` are required for Docker-in-Docker in cloud VMs (already configured in the environment).
- The dashboard JSON uses `${DS_PROMETHEUS}` as a variable for the datasource UID — this must be replaced with the actual Prometheus datasource UID when importing via API.
- There are no lint, test, or build steps for this repo since it only contains a JSON config file.
- JSON validity can be checked with: `python3 -c "import json; json.load(open('grafana-gpu-util-dashboard.json'))"`
