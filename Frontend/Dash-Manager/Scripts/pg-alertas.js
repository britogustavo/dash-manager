/* =========================================
   PG-ALERTAS.JS — DashManager
   Padronizado com o tema da página Processos
   Mantém endpoints, dados e limiares originais
   ========================================= */

"use strict";

/* ================================
   CONFIG
   ================================ */
const API_URL = "http://54.233.247.111:8000/metricas";

const LIMIAR_ALERTA = 80;
const LIMIAR_CRITICO = 90;

const INTERVALO_MS = 5000;
const MAX_PONTOS_GRAFICO = 60;
const TIMEOUT_MS = 3500;

/* ================================
   RELÓGIO SINCRONIZADO COM SERVIDOR
   Backend manda: current_time: "HH:MM:SS"
   ================================ */
let clockOffsetMs = 0;

function syncClock(serverTimeStr) {
  if (!serverTimeStr || typeof serverTimeStr !== "string") {
    return;
  }

  const parts = serverTimeStr.split(":").map(Number);

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return;
  }

  const nowClient = new Date();

  const serverNow = new Date(
    nowClient.getFullYear(),
    nowClient.getMonth(),
    nowClient.getDate(),
    parts[0],
    parts[1],
    parts[2],
    0
  );

  clockOffsetMs = serverNow.getTime() - nowClient.getTime();
}

function nowCorrect() {
  return new Date(Date.now() + clockOffsetMs);
}

function formatDateTimeBR(date) {
  return date.toLocaleString("pt-BR", {
    hour12: false
  });
}

function formatTimeBR(date) {
  return date.toLocaleTimeString("pt-BR", {
    hour12: false
  });
}

/* ================================
   HELPERS
   ================================ */
function getEl(id) {
  return document.getElementById(id);
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function cpuToPercent(cpu) {
  const value = Number(cpu) || 0;

  /*
    Compatível com:
    0.3  => 30%
    30   => 30%
  */
  return value <= 1
    ? Math.round(value * 100)
    : Math.round(value);
}

function memoryUsedPercent(memory) {
  if (!memory || !memory.total) {
    return 0;
  }

  return Math.round(
    (Number(memory.used || 0) / Number(memory.total)) * 100
  );
}

function parsePercent(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  return Number(value.replace("%", "").trim()) || 0;
}

function setText(id, text) {
  const el = getEl(id);

  if (el) {
    el.innerText = text;
  }
}

/* ================================
   INCIDENTES
   Guarda início, fim e pico
   ================================ */
const incidentesAtivos = {
  cpu: null,
  memory: null,
  disk: null
};

let historicoAlertas = loadHistory();

function loadHistory() {
  try {
    const raw = localStorage.getItem("dash_alert_history");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(
      "dash_alert_history",
      JSON.stringify(historicoAlertas)
    );
  } catch (error) {
    console.warn("Não foi possível salvar histórico:", error);
  }
}

function atualizarIncidente(chave, meta) {
  const ativo = incidentesAtivos[chave];
  const valor = Number(meta.valor || 0);

  /*
    Começou agora
  */
  if (!ativo && valor >= LIMIAR_ALERTA) {
    incidentesAtivos[chave] = {
      ...meta,
      inicio: nowCorrect(),
      pico: valor
    };

    return;
  }

  /*
    Continua ativo
  */
  if (ativo && valor >= LIMIAR_ALERTA) {
    ativo.pico = Math.max(ativo.pico, valor);
    incidentesAtivos[chave] = ativo;

    return;
  }

  /*
    Terminou agora
  */
  if (ativo && valor < LIMIAR_ALERTA) {
    const fim = nowCorrect();

    const registro = {
      titulo: ativo.titulo,
      mensagem: ativo.mensagem,
      icone: ativo.icone,
      unidade: ativo.unidade,
      inicio: ativo.inicio.toISOString(),
      fim: fim.toISOString(),
      pico: ativo.pico
    };

    historicoAlertas.unshift(registro);
    historicoAlertas = historicoAlertas.slice(0, 200);

    saveHistory();

    incidentesAtivos[chave] = null;

    renderHistorico();
  }
}

/* ================================
   CARDS DE ALERTA
   ================================ */
function criarCardHTML(alerta) {
  const isCritico =
    alerta.valor >= LIMIAR_CRITICO ||
    String(alerta.titulo).includes("Temperatura");

  const badgeClass = isCritico ? "critical" : "warning";
  const badgeText = isCritico ? "Crítico" : "Aviso";
  const badgeIcon = isCritico
    ? "fa-circle-exclamation"
    : "fa-triangle-exclamation";

  const iconStyle = isCritico
    ? "color: var(--danger); background: var(--danger-bg);"
    : "color: var(--yellow); background: var(--warning-bg);";

  const valueColor = isCritico
    ? "var(--danger)"
    : "var(--yellow)";

  return `
    <article class="alert-card">
      <div class="alert-card-header">
        <div class="alert-icon-main" style="${iconStyle}">
          <i class="fa-solid ${alerta.icone}"></i>
        </div>

        <span class="alert-badge ${badgeClass}">
          <i class="fa-solid ${badgeIcon}"></i>
          ${badgeText}
        </span>
      </div>

      <h4>${alerta.titulo}</h4>
      <p>${alerta.mensagem}</p>

      <div class="alert-footer">
        <div class="alert-time">
          <i class="fa-regular fa-clock"></i>
          ${alerta.hora} • Hoje
        </div>

        <div class="alert-value" style="color: ${valueColor}">
          Registro: ${alerta.valor}${alerta.unidade}
        </div>
      </div>
    </article>
  `;
}

function renderizarAlertasEmTela(alertas) {
  const container = getEl("alerts-grid");
  const badge = getEl("badge-count");

  if (!container) {
    return;
  }

  if (badge) {
    badge.innerText = alertas.length;
  }

  container.innerHTML = "";

  if (alertas.length === 0) {
    container.innerHTML = `
      <p class="empty-state">
        Nenhuma anomalia detectada. Servidor operando em condições ideais.
      </p>
    `;

    return;
  }

  container.innerHTML = alertas
    .map(alerta => criarCardHTML(alerta))
    .join("");
}

/* ================================
   HISTÓRICO
   ================================ */
function duracaoMs(inicioISO, fimISO) {
  const inicio = new Date(inicioISO).getTime();
  const fim = new Date(fimISO).getTime();

  return Math.max(0, fim - inicio);
}

function formatDuracao(ms) {
  const segundosTotais = Math.floor(ms / 1000);

  const horas = String(
    Math.floor(segundosTotais / 3600)
  ).padStart(2, "0");

  const minutos = String(
    Math.floor((segundosTotais % 3600) / 60)
  ).padStart(2, "0");

  const segundos = String(
    segundosTotais % 60
  ).padStart(2, "0");

  return `${horas}:${minutos}:${segundos}`;
}

function renderHistorico() {
  const el = getEl("alert-history");

  if (!el) {
    return;
  }

  if (!historicoAlertas.length) {
    el.innerHTML = `
      <p class="empty-state">
        Nenhum alerta registrado ainda.
      </p>
    `;

    return;
  }

  const rows = historicoAlertas.map(item => {
    const inicio = new Date(item.inicio);
    const fim = new Date(item.fim);
    const duracao = formatDuracao(
      duracaoMs(item.inicio, item.fim)
    );

    return `
      <div class="history-item">
        <div class="history-icon">
          <i class="fa-solid ${item.icone}"></i>
        </div>

        <div class="history-content">
          <div class="history-top">
            <strong>${item.titulo}</strong>
            <span class="history-duration">
              Duração: ${duracao}
            </span>
          </div>

          <div class="history-meta">
            Início: ${formatDateTimeBR(inicio)}
            &nbsp;|&nbsp;
            Fim: ${formatDateTimeBR(fim)}
            &nbsp;|&nbsp;
            Pico: ${item.pico}${item.unidade}
          </div>

          <div class="history-message">
            ${item.mensagem}
          </div>
        </div>
      </div>
    `;
  }).join("");

  el.innerHTML = rows;
}

/* ================================
   CHART.JS — GRÁFICO EM TEMPO REAL
   ================================ */
let chart = null;

function initChart() {
  const canvas = getEl("rt-chart");

  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const ctx = canvas.getContext("2d");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "CPU (%)",
          data: [],
          borderColor: "#3B82F6",
          backgroundColor: "rgba(59, 130, 246, 0.12)",
          borderWidth: 2,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false
        },
        {
          label: "Memória (%)",
          data: [],
          borderColor: "#22C55E",
          backgroundColor: "rgba(34, 197, 94, 0.12)",
          borderWidth: 2,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false
        },
        {
          label: "Disco (%)",
          data: [],
          borderColor: "#EAB308",
          backgroundColor: "rgba(234, 179, 8, 0.12)",
          borderWidth: 2,
          tension: 0.28,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#94A3B8",
            boxWidth: 12,
            boxHeight: 12,
            usePointStyle: true,
            pointStyle: "circle",
            font: {
              family: "Inter",
              size: 12,
              weight: "600"
            }
          }
        },
        tooltip: {
          backgroundColor: "#0A1122",
          titleColor: "#F8FAFC",
          bodyColor: "#94A3B8",
          borderColor: "#1A2438",
          borderWidth: 1,
          padding: 10,
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#94A3B8",
            maxRotation: 0,
            autoSkip: true,
            font: {
              family: "Inter",
              size: 11
            }
          },
          grid: {
            color: "rgba(148, 163, 184, 0.08)",
            drawBorder: false
          }
        },
        y: {
          min: 0,
          max: 100,
          ticks: {
            color: "#94A3B8",
            stepSize: 20,
            callback: value => `${value}%`,
            font: {
              family: "Inter",
              size: 11
            }
          },
          grid: {
            color: "rgba(148, 163, 184, 0.10)",
            drawBorder: false
          }
        }
      }
    }
  });
}

function pushChartPoint(label, cpu, mem, disk) {
  if (!chart) {
    return;
  }

  chart.data.labels.push(label);

  chart.data.datasets[0].data.push(clamp(cpu));
  chart.data.datasets[1].data.push(clamp(mem));
  chart.data.datasets[2].data.push(clamp(disk));

  if (chart.data.labels.length > MAX_PONTOS_GRAFICO) {
    chart.data.labels.shift();

    chart.data.datasets.forEach(dataset => {
      dataset.data.shift();
    });
  }

  chart.update("none");
}

/* ================================
   FETCH
   ================================ */
async function buscarMetricas() {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/* ================================
   LOOP PRINCIPAL
   ================================ */
async function atualizarTudo() {
  try {
    const metricas = await buscarMetricas();

    syncClock(metricas.current_time);

    const cpuPct = cpuToPercent(metricas.cpu);
    const memPct = memoryUsedPercent(metricas.memory);
    const diskPct = parsePercent(metricas?.disk?.usage_percent);

    const label =
      metricas.current_time ||
      formatTimeBR(nowCorrect());

    pushChartPoint(
      label,
      cpuPct,
      memPct,
      diskPct
    );

    atualizarIncidente("cpu", {
      titulo: "CPU",
      mensagem: "Uso elevado do processador detectado.",
      valor: cpuPct,
      unidade: "%",
      icone: "fa-microchip"
    });

    atualizarIncidente("memory", {
      titulo: "Memória RAM",
      mensagem: "Consumo elevado de memória detectado.",
      valor: memPct,
      unidade: "%",
      icone: "fa-memory"
    });

    atualizarIncidente("disk", {
      titulo: "Disco",
      mensagem: "Uso elevado de armazenamento detectado.",
      valor: diskPct,
      unidade: "%",
      icone: "fa-hard-drive"
    });

    const alertasAgora = [];

    if (cpuPct >= LIMIAR_ALERTA) {
      alertasAgora.push({
        titulo: "CPU",
        mensagem: "Uso elevado do processador.",
        valor: cpuPct,
        unidade: "%",
        icone: "fa-microchip",
        hora: label
      });
    }

    if (memPct >= LIMIAR_ALERTA) {
      alertasAgora.push({
        titulo: "Memória RAM",
        mensagem: "Consumo elevado de memória.",
        valor: memPct,
        unidade: "%",
        icone: "fa-memory",
        hora: label
      });
    }

    if (diskPct >= LIMIAR_ALERTA) {
      alertasAgora.push({
        titulo: "Disco",
        mensagem: "Armazenamento alto.",
        valor: diskPct,
        unidade: "%",
        icone: "fa-hard-drive",
        hora: label
      });
    }

    renderizarAlertasEmTela(alertasAgora);
  } catch (error) {
    console.warn(
      "Falha ao atualizar métricas:",
      error?.message || error
    );

    const container = getEl("alerts-grid");

    if (container) {
      container.innerHTML = `
        <p class="empty-state">
          Não foi possível atualizar as métricas no momento.
          Verifique a API e tente novamente.
        </p>
      `;
    }
  }
}

/* ================================
   RELÓGIO DO TOPO
   ================================ */
function atualizarRelogioTopo() {
  setText(
    "hora-atual",
    formatTimeBR(nowCorrect())
  );
}

/* ================================
   INIT
   ================================ */
window.addEventListener("load", () => {
  initChart();
  renderHistorico();

  atualizarRelogioTopo();
  setInterval(atualizarRelogioTopo, 1000);

  atualizarTudo();
  setInterval(atualizarTudo, INTERVALO_MS);
});