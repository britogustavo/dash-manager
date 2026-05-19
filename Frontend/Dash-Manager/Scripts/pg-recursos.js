/* =========================================
   PG-RECURSOS.JS — DashManager
   Detalhes avançados com Chart.js
   Endpoint: /metricas (não altera backend)
   ========================================= */

"use strict";

/* ================================
   CONFIG
   ================================ */
const API_URL = "http://54.233.247.111:8000/metricas";
const INTERVALO_MS = 5000;
const MAX_POINTS = 30;

/* ================================
   HISTÓRICO (janela)
   ================================ */
const hist = {
  cpu: [],
  ram: [],
  disk: [],
  dl: [],
  ul: [],
  temp: []
};

/* ================================
   HELPERS
   ================================ */
function $(id) { return document.getElementById(id); }

function clamp(v, min = 0, max = 100) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function cpuNormalize(cpu) {
  const n = Number(cpu) || 0;
  return n <= 1 ? n * 100 : n;
}

function parsePercent(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("%", "").trim()) || 0;
  return 0;
}

function pushWindow(arr, value) {
  arr.push(value);
  if (arr.length > MAX_POINTS) arr.shift();
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function peak(arr) {
  return arr.length ? Math.max(...arr) : 0;
}

function setText(id, value) {
  const el = $(id);
  if (el) el.innerText = value;
}

function setBar(id, pct) {
  const el = $(id);
  if (!el) return;
  el.style.width = clamp(pct, 0, 100) + "%";
}

/* ================================
   STATUS HELPERS
   ================================ */
function statusLabelByPct(pct) {
  if (pct >= 90) return { label: "Crítico", color: "var(--danger)", dot: "var(--danger)" };
  if (pct >= 80) return { label: "Atenção", color: "var(--yellow)", dot: "var(--yellow)" };
  return { label: "Normal", color: "var(--green)", dot: "var(--green)" };
}

function statusLabelTemp(tempC) {
  if (tempC >= 80) return { label: "Crítico", color: "var(--danger)" };
  if (tempC >= 70) return { label: "Atenção", color: "var(--yellow)" };
  return { label: "Normal", color: "var(--green)" };
}

function setStatusChip(containerId, pctOrTemp, isTemp = false) {
  const el = $(containerId);
  if (!el) return;

  const dot = el.querySelector(".status-dot");
  const text = el.querySelector("span:last-child");

  const st = isTemp ? statusLabelTemp(pctOrTemp) : statusLabelByPct(pctOrTemp);

  if (dot) {
    dot.style.background = st.color;
    dot.style.boxShadow = "0 0 0 3px rgba(255,255,255,0.06)";
  }

  if (text) {
    text.innerText = st.label;
    text.style.color = "var(--text-primary)";
  }

  el.style.borderColor = "rgba(255,255,255,0.10)";
}

/* ================================
   HEALTH SCORE
   ================================ */
function calcHealth(cpuPct, ramPct, diskPct, tempC) {
  let score = 100;

  // CPU
  if (cpuPct >= 90) score -= 25;
  else if (cpuPct >= 80) score -= 12;

  // RAM
  if (ramPct >= 90) score -= 25;
  else if (ramPct >= 80) score -= 12;

  // Disk
  if (diskPct >= 90) score -= 25;
  else if (diskPct >= 80) score -= 12;

  // Temp (se válido)
  if (tempC !== null) {
    if (tempC >= 85) score -= 30;
    else if (tempC >= 80) score -= 20;
    else if (tempC >= 70) score -= 8;
  }

  return clamp(score, 0, 100);
}

function healthText(score) {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 55) return "Atenção";
  return "Crítico";
}

/* ================================
   CHARTS
   ================================ */
let cpuLineChart = null;
let networkLineChart = null;
let ramPieChart = null;
let diskPieChart = null;
let tempPieChart = null;

function initCharts() {
  if (typeof Chart === "undefined") return;

  // Defaults theme (escuro)
  Chart.defaults.color = "#94A3B8";
  Chart.defaults.font.family = "Inter";

  // CPU Line (1 dataset)
  const cpuCanvas = $("cpuLineChart");
  if (cpuCanvas) {
    cpuLineChart = new Chart(cpuCanvas.getContext("2d"), {
      type: "line",
      data: { labels: [], datasets: [{
        label: "CPU (%)",
        data: [],
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59,130,246,0.12)",
        borderWidth: 2,
        tension: 0.28,
        pointRadius: 0,
        fill: false
      }]},
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { display: false, grid: { display: false } },
          y: { min: 0, max: 100, display: false, grid: { display: false } }
        }
      }
    });
  }

  // Network Line (2 datasets)
  const netCanvas = $("networkLineChart");
  if (netCanvas) {
    networkLineChart = new Chart(netCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Download (Kbps)",
            data: [],
            borderColor: "#3B82F6",
            borderWidth: 2,
            tension: 0.28,
            pointRadius: 0,
            fill: false
          },
          {
            label: "Upload (Kbps)",
            data: [],
            borderColor: "#22C55E",
            borderWidth: 2,
            tension: 0.28,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false, grid: { display: false } },
          y: { display: false, grid: { display: false } }
        }
      }
    });
  }

  // Doughnuts
  const makeDoughnut = (canvasId, color) => {
    const c = $(canvasId);
    if (!c) return null;

    return new Chart(c.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Uso", "Livre"],
        datasets: [{
          data: [0, 100],
          backgroundColor: [color, "rgba(26,36,56,0.9)"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } }
      }
    });
  };

  ramPieChart = makeDoughnut("ramPieChart", "#22C55E");
  diskPieChart = makeDoughnut("diskPieChart", "#EAB308");
  tempPieChart = makeDoughnut("tempPieChart", "#EF4444");
}

function pushLine(chart, value) {
  if (!chart) return;

  chart.data.labels.push("");
  chart.data.datasets[0].data.push(value);

  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }

  chart.update("none");
}

function pushNetwork(chart, dl, ul) {
  if (!chart) return;

  chart.data.labels.push("");
  chart.data.datasets[0].data.push(dl);
  chart.data.datasets[1].data.push(ul);

  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds => ds.data.shift());
  }

  chart.update("none");
}

function setDoughnut(chart, pct) {
  if (!chart) return;
  const p = clamp(pct, 0, 100);
  chart.data.datasets[0].data = [p, 100 - p];
  chart.update("none");
}

/* ================================
   RENDER / UPDATE UI
   ================================ */
function bytesToGB(bytes) {
  return (Number(bytes || 0) / 1024 / 1024).toFixed(1);
}

function updateUI(metricas) {
  // Hora
  setText("horaAtual", metricas.current_time || new Date().toLocaleTimeString("pt-BR", { hour12: false }));

  // CPU
  const cpuPct = cpuNormalize(metricas.cpu);
  pushWindow(hist.cpu, cpuPct);

  setText("cpuUso", cpuPct.toFixed(1) + "%");
  setText("cpuMedia", avg(hist.cpu).toFixed(0) + "%");
  setText("cpuPico", peak(hist.cpu).toFixed(0) + "%");
  setStatusChip("cpuStatus", cpuPct, false);
  pushLine(cpuLineChart, cpuPct);

  // RAM
  const memTotal = Number(metricas?.memory?.total || 0);
  const memUsed = Number(metricas?.memory?.used || 0);
  const memAvail = Number(metricas?.memory?.available || Math.max(0, memTotal - memUsed));
  const ramPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;

  pushWindow(hist.ram, ramPct);

  setText("ramTotal", bytesToGB(memTotal) + " GB");
  setText("ramUsada", bytesToGB(memUsed) + " GB");
  setText("ramLivre", bytesToGB(memAvail) + " GB");
  setText("ramPercentual", ramPct.toFixed(1) + "%");
  setBar("ramBar", ramPct);
  setDoughnut(ramPieChart, ramPct);

  // DISCO
  const diskPct = parsePercent(metricas?.disk?.usage_percent);
  pushWindow(hist.disk, diskPct);

  setText("discoUso", diskPct.toFixed(1) + "%");
  setText("discoTotal", metricas?.disk?.total ?? "--");
  setText("discoLivre", metricas?.disk?.available ?? "--");

  // status disco
  const diskSt = statusLabelByPct(diskPct).label;
  setText("discoStatus", diskSt);

  setBar("diskBarPrincipal", diskPct);
  setText("diskPrincipalPercent", diskPct.toFixed(1) + "%");

  const reservaPct = clamp(100 - diskPct, 0, 100);
  setBar("diskBarReserva", reservaPct);
  setText("diskReservaPercent", reservaPct.toFixed(1) + "%");

  setDoughnut(diskPieChart, diskPct);

  // REDE (rx_rate/tx_rate em bytes/s => converte para Kbps (mantendo padrão semelhante às outras páginas))
  const downloadKbps = (Number(metricas?.network?.rx_rate || 0) / 1024).toFixed(2);
  const uploadKbps = (Number(metricas?.network?.tx_rate || 0) / 1024).toFixed(2);

  const dl = Number(downloadKbps) || 0;
  const ul = Number(uploadKbps) || 0;

  pushWindow(hist.dl, dl);
  pushWindow(hist.ul, ul);

  setText("downloadValor", dl.toFixed(2) + " Kbps");
  setText("uploadValor", ul.toFixed(2) + " Kbps");

  setText("downloadMedia", avg(hist.dl).toFixed(2) + " Kbps");
  setText("uploadMedia", avg(hist.ul).toFixed(2) + " Kbps");
  setText("downloadPico", peak(hist.dl).toFixed(2) + " Kbps");
  setText("uploadPico", peak(hist.ul).toFixed(2) + " Kbps");

  pushNetwork(networkLineChart, dl, ul);

  // TEMPERATURA
  const tempRaw = Number(metricas?.temperature);
  const tempVal = (!Number.isNaN(tempRaw) && tempRaw >= 0) ? tempRaw : null;

  if (tempVal === null) {
    setText("temperaturaAtual", "N/A");
    setText("temperaturaStatus", "Sensor indisponível");
    setDoughnut(tempPieChart, 0);
    pushWindow(hist.temp, 0);
  } else {
    pushWindow(hist.temp, tempVal);
    setText("temperaturaAtual", tempVal.toFixed(1) + "°C");

    const st = statusLabelTemp(tempVal);
    setText("temperaturaStatus", st.label);

    // doughnut da temperatura escala 0..100 (apenas visual)
    setDoughnut(tempPieChart, clamp(tempVal, 0, 100));
  }

  // HEALTH
  const health = calcHealth(cpuPct, ramPct, diskPct, tempVal);
  setText("healthScore", health.toFixed(0) + "%");
  setText("healthStatus", healthText(health));

  setText("healthCpu", statusLabelByPct(cpuPct).label);
  setText("healthRam", statusLabelByPct(ramPct).label);
  setText("healthDisk", statusLabelByPct(diskPct).label);
  setText("healthTemp", tempVal === null ? "N/A" : statusLabelTemp(tempVal).label);
}

/* ================================
   FETCH
   ================================ */
async function fetchMetricas() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

/* ================================
   LOOP
   ================================ */
async function tick() {
  try {
    const metricas = await fetchMetricas();
    updateUI(metricas);
  } catch (e) {
    console.warn("Falha ao atualizar recursos:", e?.message || e);
  }
}

/* ================================
   INIT
   ================================ */
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  tick();
  setInterval(tick, INTERVALO_MS);
});