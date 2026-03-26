import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const GPU_UTIL_METRIC = 'DCGM_FI_DEV_GPU_UTIL';
const FB_USED = 'DCGM_FI_DEV_FB_USED';
const FB_FREE = 'DCGM_FI_DEV_FB_FREE';

/** @type {Map<string, Chart>} */
const charts = new Map();

/** IPs seen when no instance filter is applied (keeps dropdown useful after filtering). */
const knownInstanceIps = new Set();

function defaultBaseUrl() {
  const input = document.getElementById('baseUrl').value.trim();
  if (input) return input.replace(/\/$/, '');
  if (import.meta.env.DEV) {
    return `${window.location.origin}/prometheus`;
  }
  return '';
}

function promFetch(base, path, params) {
  const url = new URL(path, `${base}/`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return fetch(url.toString()).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    return r.json();
  });
}

function promQuery(base, query) {
  return promFetch(base, 'api/v1/query', { query });
}

function promQueryRange(base, query, start, end, step) {
  return promFetch(base, 'api/v1/query_range', {
    query,
    start: String(start),
    end: String(end),
    step: String(step),
  });
}

function escapeInstanceIpForRegex(ip) {
  return ip.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function seriesKey(m) {
  const node = m.node ?? '';
  const gpu = m.gpu ?? '';
  return `${node}\0${gpu}`;
}

function parseInstanceIp(instance) {
  if (!instance || typeof instance !== 'string') return '';
  const idx = instance.lastIndexOf(':');
  return idx > 0 ? instance.slice(0, idx) : instance;
}

function pickStep(start, end) {
  const span = end - start;
  const raw = Math.max(15, Math.floor(span / 800));
  if (raw <= 60) return `${raw}s`;
  if (raw <= 3600) return `${Math.floor(raw / 60)}m`;
  return `${Math.floor(raw / 3600)}h`;
}

function aggregateStats(values) {
  const nums = values.map(Number).filter((n) => !Number.isNaN(n));
  if (!nums.length) return { min: null, max: null, mean: null };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return { min, max, mean };
}

function utilClass(v) {
  if (v >= 90) return 'util-max';
  if (v >= 70) return 'util-high';
  return '';
}

function destroyAllCharts() {
  charts.forEach((c) => c.destroy());
  charts.clear();
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

/** PromQL selector suffix e.g. `{instance=~"10\\.1\\.1\\.1:.*"}` or empty string */
function labelSelector(instanceIp) {
  if (!instanceIp) return '';
  const esc = escapeInstanceIpForRegex(instanceIp);
  return `{instance=~"${esc}:.*"}`;
}

function buildQueries(instanceIp) {
  const sel = labelSelector(instanceIp);
  const utilQuery = sel ? `${GPU_UTIL_METRIC}${sel}` : GPU_UTIL_METRIC;
  const memQuery = sel
    ? `100 * ${FB_USED}${sel} / clamp_min((${FB_USED}${sel} + ${FB_FREE}${sel}), 1)`
    : `100 * ${FB_USED} / clamp_min((${FB_USED} + ${FB_FREE}), 1)`;
  return { utilQuery, memQuery };
}

async function load() {
  const base = defaultBaseUrl();
  if (!base) {
    setStatus('请填写 Prometheus 根地址（例如 http://host:32003），或使用 npm run dev 走本地代理。', true);
    return;
  }

  const instanceIp = document.getElementById('ipFilter').value.trim();
  const rangeSec = parseInt(document.getElementById('rangePreset').value, 10) || 21600;
  const end = Math.floor(Date.now() / 1000);
  const start = end - rangeSec;
  const step = pickStep(start, end);

  const { utilQuery, memQuery } = buildQueries(instanceIp);

  setStatus('查询中…');

  let utilVec;
  let utilRange;
  let memRange;
  try {
    const [qInst, qUtil, qMem] = await Promise.all([
      promQuery(base, utilQuery),
      promQueryRange(base, utilQuery, start, end, step),
      promQueryRange(base, memQuery, start, end, step),
    ]);
    if (qInst.status !== 'success') throw new Error(qInst.error || 'instant query failed');
    if (qUtil.status !== 'success') throw new Error(qUtil.error || 'range util failed');
    if (qMem.status !== 'success') throw new Error(qMem.error || 'range mem failed');
    utilVec = qInst.data.result;
    utilRange = qUtil.data.result;
    memRange = qMem.data.result;
  } catch (e) {
    setStatus(String(e.message || e), true);
    return;
  }

  const ipsThisQuery = new Set();
  utilVec.forEach((r) => {
    const ip = parseInstanceIp(r.metric.instance);
    if (ip) ipsThisQuery.add(ip);
  });
  if (!instanceIp) {
    ipsThisQuery.forEach((ip) => knownInstanceIps.add(ip));
  }
  const optionIps =
    knownInstanceIps.size > 0
      ? Array.from(knownInstanceIps).sort()
      : Array.from(ipsThisQuery).sort();
  updateIpOptions(optionIps, instanceIp);

  const memByKey = new Map();
  memRange.forEach((r) => {
    memByKey.set(seriesKey(r.metric), r);
  });

  const utilRangeByKey = new Map();
  utilRange.forEach((r) => {
    utilRangeByKey.set(seriesKey(r.metric), r);
  });

  const byNode = new Map();
  utilVec.forEach((r) => {
    const node = r.metric.node ?? '(unknown)';
    const gpu = r.metric.gpu ?? '?';
    const current = Number(r.value[1]);
    if (!byNode.has(node)) byNode.set(node, []);
    byNode.get(node).push({
      metric: r.metric,
      gpu,
      current: Number.isFinite(current) ? current : null,
      range: utilRangeByKey.get(seriesKey(r.metric)),
      memRange: memByKey.get(seriesKey(r.metric)),
    });
  });

  byNode.forEach((arr) => arr.sort((a, b) => Number(a.gpu) - Number(b.gpu)));

  renderGrid(byNode, start, end);
  setStatus(
    `已更新 · 序列 ${utilVec.length} 条 · 范围 ${new Date(start * 1000).toLocaleString()} — ${new Date(end * 1000).toLocaleString()}`
  );
}

function updateIpOptions(ips, selected) {
  const sel = document.getElementById('ipFilter');
  const keep = sel.value;
  sel.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = '全部';
  sel.appendChild(optAll);
  ips.forEach((ip) => {
    const o = document.createElement('option');
    o.value = ip;
    o.textContent = ip;
    sel.appendChild(o);
  });
  if (selected && ips.includes(selected)) sel.value = selected;
  else if (keep && ips.includes(keep)) sel.value = keep;
}

function renderGrid(byNode, start, end) {
  destroyAllCharts();
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const nodes = Array.from(byNode.keys()).sort();
  if (!nodes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '所选条件下没有 GPU 指标（检查 Prometheus 或实例 IP 筛选）。';
    grid.appendChild(empty);
    return;
  }

  nodes.forEach((node) => {
    const section = document.createElement('section');
    section.className = 'node-section';
    const h2 = document.createElement('h2');
    h2.innerHTML = `<span>${escapeHtml(node)}</span>`;
    const cards = document.createElement('div');
    cards.className = 'cards';

    const list = byNode.get(node);
    const firstIp = list[0]?.metric?.instance
      ? parseInstanceIp(list[0].metric.instance)
      : '';
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${list.length} 张 GPU${firstIp ? ` · 示例实例 ${firstIp}` : ''}`;
    h2.appendChild(meta);

    list.forEach((item) => {
      cards.appendChild(renderCard(item, start, end));
    });

    section.appendChild(h2);
    section.appendChild(cards);
    grid.appendChild(section);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderCard(item, start, end) {
  const { metric, gpu, current, range, memRange } = item;
  const card = document.createElement('article');
  card.className = 'gpu-card';

  const header = document.createElement('header');
  const left = document.createElement('div');
  left.innerHTML = `<div class="title">GPU ${escapeHtml(String(gpu))}</div>`;
  if (metric.modelName) {
    const m = document.createElement('div');
    m.className = 'model';
    m.textContent = metric.modelName;
    left.appendChild(m);
  }
  const right = document.createElement('div');
  right.className = 'ip';
  right.textContent = metric.instance ?? '';
  header.appendChild(left);
  header.appendChild(right);
  card.appendChild(header);

  const utilVals = range?.values?.map((v) => v[1]) ?? [];
  const memVals = memRange?.values?.map((v) => v[1]) ?? [];
  const uStats = aggregateStats(utilVals);
  const mStats = aggregateStats(memVals);
  const memCurrent =
    memRange?.values?.length > 0 ? Number(memRange.values[memRange.values.length - 1][1]) : null;

  const qps = document.createElement('div');
  qps.className = 'qps-row';

  const utilBlock = document.createElement('div');
  utilBlock.className = 'metric';
  utilBlock.innerHTML = `<span class="label">GPU 利用率 · 当前</span>`;
  const vUtil = document.createElement('span');
  vUtil.className = `value-lg ${utilClass(current ?? 0)}`;
  vUtil.textContent = current != null ? `${current.toFixed(1)}%` : '—';
  utilBlock.appendChild(vUtil);
  const subU = document.createElement('div');
  subU.className = 'sub';
  subU.textContent =
    uStats.min != null
      ? `区间 min ${uStats.min.toFixed(1)} · max ${uStats.max.toFixed(1)} · mean ${uStats.mean.toFixed(1)}`
      : '无历史采样';
  utilBlock.appendChild(subU);

  const memBlock = document.createElement('div');
  memBlock.className = 'metric';
  memBlock.innerHTML = `<span class="label">显存占用率 · 当前</span>`;
  const vMem = document.createElement('span');
  vMem.className = 'value-lg';
  vMem.textContent = memCurrent != null && Number.isFinite(memCurrent) ? `${memCurrent.toFixed(1)}%` : '—';
  memBlock.appendChild(vMem);
  const subM = document.createElement('div');
  subM.className = 'sub';
  subM.textContent =
    mStats.min != null
      ? `区间 min ${mStats.min.toFixed(1)} · max ${mStats.max.toFixed(1)} · mean ${mStats.mean.toFixed(1)}`
      : '无历史采样';
  memBlock.appendChild(subM);

  qps.appendChild(utilBlock);
  qps.appendChild(memBlock);
  card.appendChild(qps);

  const wrap = document.createElement('div');
  wrap.className = 'chart-wrap';
  const canvas = document.createElement('canvas');
  wrap.appendChild(canvas);
  card.appendChild(wrap);

  const utilPoints =
    range?.values?.map(([t, v]) => ({ x: Number(t), y: Number(v) })) ?? [];
  const memPoints =
    memRange?.values?.map(([t, v]) => ({ x: Number(t), y: Number(v) })) ?? [];

  const chartId = `${metric.node}|${metric.gpu}`;
  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'GPU %',
          data: utilPoints,
          borderColor: 'rgb(61, 158, 255)',
          backgroundColor: 'rgba(61, 158, 255, 0.08)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1.5,
        },
        {
          label: '显存 %',
          data: memPoints,
          borderColor: 'rgb(62, 207, 142)',
          backgroundColor: 'rgba(62, 207, 142, 0.06)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      parsing: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 10, font: { size: 10 } },
        },
        tooltip: {
          callbacks: {
            title(items) {
              if (!items.length) return '';
              const x = items[0].parsed.x;
              return new Date(x * 1000).toLocaleString();
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          min: start,
          max: end,
          ticks: {
            maxTicksLimit: 6,
            callback(v) {
              return new Date(v * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          min: 0,
          max: 100,
          ticks: { callback: (v) => `${v}%` },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    },
  });
  charts.set(chartId, chart);

  return card;
}

let refreshTimer = null;

function setup() {
  document.getElementById('refreshBtn').addEventListener('click', () => load());
  document.getElementById('rangePreset').addEventListener('change', () => load());
  document.getElementById('ipFilter').addEventListener('change', () => load());
  document.getElementById('baseUrl').addEventListener('change', () => load());

  document.getElementById('autoRefresh').addEventListener('change', () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
    if (document.getElementById('autoRefresh').checked) {
      refreshTimer = setInterval(() => load(), 30000);
    }
  });

  load();
  refreshTimer = setInterval(() => load(), 30000);
}

setup();
