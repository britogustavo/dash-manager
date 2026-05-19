/* =========================================
   PG-PROCESSOS.JS — DashManager
   Completo + corrigido + integrado API real
   ========================================= */

"use strict";

/* ================================
   CONFIG
   ================================ */
const API_URL = "http://54.233.247.111:8000/metricas";
const INTERVALO = 5000;

/* ================================
   ESTADO GLOBAL
   ================================ */
let listaGlobal = [];

let modoTop = "cpu";

let searchTerm = "";

let stateFilterValue = "all";

let serviceFilterValue = "all";

/* ================================
   HELPERS
   ================================ */
function getEl(id) {
  return document.getElementById(id);
}

function setText(id, value) {

  const el = getEl(id);

  if (el) {
    el.innerText = value;
  }
}

function formatNumber(value, casas = 1) {

  const n = Number(value);

  if (Number.isNaN(n)) {
    return "--";
  }

  return n.toFixed(casas);
}

function formatBytes(bytes) {

  const b = Number(bytes);

  if (!b || Number.isNaN(b)) {
    return "--";
  }

  const kb = b / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) {
    return gb.toFixed(2) + " GB";
  }

  if (mb >= 1) {
    return mb.toFixed(2) + " MB";
  }

  return kb.toFixed(2) + " KB";
}

function stateLetter(stateStr) {

  const s = String(stateStr || "").trim();

  return s
    ? s.charAt(0).toUpperCase()
    : "-";
}

function setBar(id, value, max = 100) {

  const el = getEl(id);

  if (!el) {
    return;
  }

  const pct =
    Math.min(
      100,
      (Number(value) / max) * 100
    );

  el.style.width = pct + "%";
}

function formatUptime(segundos) {

  const total = Number(segundos || 0);

  const dias =
    Math.floor(total / 86400);

  const horas =
    Math.floor((total % 86400) / 3600);

  const minutos =
    Math.floor((total % 3600) / 60);

  if (dias > 0) {
    return `${dias}d ${horas}h ${minutos}m`;
  }

  return `${horas}h ${minutos}m`;
}

/* ================================
   DETECTAR SERVIÇO
   ================================ */
function detectarServico(nome) {

  const n =
    String(nome || "").toLowerCase();

  if (
    n.includes("nginx") ||
    n.includes("apache") ||
    n.includes("httpd")
  ) {
    return "web";
  }

  if (
    n.includes("mysql") ||
    n.includes("postgres") ||
    n.includes("mariadb")
  ) {
    return "db";
  }

  if (
    n.includes("redis") ||
    n.includes("memcached")
  ) {
    return "cache";
  }

  return "other";
}

/* ================================
   FILTROS
   ================================ */
function aplicarFiltros(lista) {

  return lista.filter(proc => {

    const texto =
      (
        proc.pid + " " +
        proc.name + " " +
        proc.cmd + " " +
        proc.user
      )
      .toLowerCase();

    const matchBusca =
      texto.includes(searchTerm);

    const estado =
      stateLetter(proc.state);

    const matchEstado =
      stateFilterValue === "all"
      || estado === stateFilterValue;

    const servico =
      detectarServico(proc.name);

    const matchServico =
      serviceFilterValue === "all"
      || servico === serviceFilterValue;

    return (
      matchBusca &&
      matchEstado &&
      matchServico
    );
  });
}

/* ================================
   SERVIÇOS
   ================================ */
function renderizarServicos(lista) {

  const container =
    getEl("servicesList");

  if (!container) {
    return;
  }

  const web =
    lista.some(p =>
      detectarServico(p.name) === "web"
    );

  const db =
    lista.some(p =>
      detectarServico(p.name) === "db"
    );

  const cache =
    lista.some(p =>
      detectarServico(p.name) === "cache"
    );

  container.innerHTML = `
    <div class="service-item">
      <span>Web Server</span>

      <strong class="${web ? "ok" : "fail"}">
        ${web ? "Online" : "Offline"}
      </strong>
    </div>

    <div class="service-item">
      <span>Banco de Dados</span>

      <strong class="${db ? "ok" : "fail"}">
        ${db ? "Online" : "Offline"}
      </strong>
    </div>

    <div class="service-item">
      <span>Cache</span>

      <strong class="${cache ? "ok" : "fail"}">
        ${cache ? "Online" : "Offline"}
      </strong>
    </div>
  `;

  setText("kvWeb", web ? "Online" : "Offline");
  setText("kvDb", db ? "Online" : "Offline");
  setText("kvCache", cache ? "Online" : "Offline");
}

/* ================================
   ALERTAS
   ================================ */
function atualizarAlertas(lista) {

  const zombies =
    lista.filter(p =>
      stateLetter(p.state) === "Z"
    ).length;

  const stopped =
    lista.filter(p =>
      stateLetter(p.state) === "T"
    ).length;

  const badge =
    getEl("lastAlertBadge");

  const severity =
    getEl("lastAlertSeverity");

  const title =
    getEl("lastAlertTitle");

  const desc =
    getEl("lastAlertDesc");

  const time =
    getEl("lastAlertTime");

  const pid =
    getEl("lastAlertPid");

  const hora =
    new Date().toLocaleTimeString(
      "pt-BR",
      {
        hour12: false
      }
    );

  if (zombies > 0) {

    badge.style.display = "inline-flex";

    badge.classList.remove("warning");
    badge.classList.add("critical");

    severity.innerText = "Crítico";

    title.innerText =
      "Processo zumbi detectado";

    desc.innerText =
      `Há ${zombies} processo(s) em estado Z.`;

    time.innerText = hora;

    pid.innerText = "PID: --";

    return;
  }

  if (stopped > 0) {

    badge.style.display = "inline-flex";

    badge.classList.remove("critical");
    badge.classList.add("warning");

    severity.innerText = "Atenção";

    title.innerText =
      "Processo parado detectado";

    desc.innerText =
      `Há ${stopped} processo(s) em estado T.`;

    time.innerText = hora;

    pid.innerText = "PID: --";

    return;
  }

  badge.style.display = "none";

  title.innerText =
    "Sem alertas";

  desc.innerText =
    "Nenhum evento crítico registrado.";

  time.innerText = "--";

  pid.innerText = "PID: --";
}

/* ================================
   TOP PROCESSOS
   ================================ */
function renderizarTop(lista) {

  const topTable =
    getEl("topTable");

  if (!topTable) {
    return;
  }

  let top = [];

  if (modoTop === "cpu") {

    top =
      [...lista]
        .sort((a, b) =>
          (b.cpu || 0) -
          (a.cpu || 0)
        )
        .slice(0, 8);

  } else {

    top =
      [...lista]
        .sort((a, b) =>
          (b.mem || 0) -
          (a.mem || 0)
        )
        .slice(0, 8);
  }

  if (!top.length) {

    topTable.innerHTML = `
      <div class="muted">
        Sem dados de processos.
      </div>
    `;

    return;
  }

  topTable.innerHTML =
    top.map(p => {

      const pid =
        p.pid ?? "--";

      const name =
        p.name ?? "--";

      const state =
        stateLetter(p.state);

      const valor =
        modoTop === "cpu"
          ? `${formatNumber(p.cpu)}% CPU`
          : `${formatNumber(p.mem)}% RAM`;

      return `
        <div class="mini-row">

          <div class="mini-proc">
            <strong>${name}</strong>

            <span>
              PID ${pid} • Estado ${state}
            </span>
          </div>

          <div class="mini-badge">
            ${state}
          </div>

          <div class="mini-num">
            ${valor}
          </div>

        </div>
      `;
    }).join("");
}

/* ================================
   TABELA
   ================================ */
function renderizarTabela(lista) {

  const tbody =
    getEl("procTbody");

  if (!tbody) {
    return;
  }

  if (!lista.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="loading">
          Sem processos.
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML =
    lista.map(p => {

      const pid =
        p.pid ?? "--";

      const name =
        p.name ?? "--";

      const user =
        p.user ?? "root";

      const cpu =
        formatNumber(p.cpu);

      const mem =
        formatNumber(p.mem);

      const rss =
        formatBytes(p.rss);

      const threads =
        p.threads ?? 0;

      const etime =
        formatUptime(p.etime);

      const cmd =
        p.cmd ?? "--";

      const state =
        stateLetter(p.state);

      return `
        <tr>

          <td>${pid}</td>

          <td>${name}</td>

          <td>${user}</td>

          <td>
            <span class="state-pill ${state.toLowerCase()}">
              ${state}
            </span>
          </td>

          <td>${cpu}%</td>

          <td>${mem}%</td>

          <td>${rss}</td>

          <td>${threads}</td>

          <td>${etime}</td>

          <td class="cmd">
            ${cmd}
          </td>

        </tr>
      `;
    }).join("");

  setText(
    "rowsInfo",
    `${lista.length} processos carregados`
  );
}

/* ================================
   KPIs
   ================================ */
function atualizarKpis(lista, dados) {

  const totalProcessos =
    dados.processes || lista.length;

  const totalThreads =
    dados.threads || 0;

  const running =
    lista.filter(p =>
      stateLetter(p.state) === "R"
    ).length;

  const zombies =
    lista.filter(p =>
      stateLetter(p.state) === "Z"
    ).length;

  const stopped =
    lista.filter(p =>
      stateLetter(p.state) === "T"
    ).length;

  const anomalies =
    zombies + stopped;

  /* ================================
     TOP CPU
     ================================ */
  const topCpu =
    [...lista]
      .sort((a, b) =>
        (b.cpu || 0) -
        (a.cpu || 0)
      )[0];

  /* ================================
     TOP MEM
     ================================ */
  const topMem =
    [...lista]
      .sort((a, b) =>
        (b.mem || 0) -
        (a.mem || 0)
      )[0];

  /* ================================
     TEXTO
     ================================ */
  setText("kpiTotal", totalProcessos);

  setText("kpiRunning", running);

  setText("kpiThreads", totalThreads);

  setText(
    "kpiThreadsAvg",
    totalProcessos > 0
      ? (totalThreads / totalProcessos).toFixed(1)
      : "0"
  );

  setText("kpiAnomalias", anomalies);

  setText("kpiZombie", zombies);

  /* ================================
     CPU
     ================================ */
  if (topCpu) {

    setText(
      "kpiCpuTop",
      formatNumber(topCpu.cpu) + "%"
    );

    setText(
      "kpiCpuPid",
      topCpu.pid
    );

    setBar(
      "barCpuTop",
      topCpu.cpu || 0,
      100
    );
  }

  /* ================================
     MEM
     ================================ */
  if (topMem) {

    setText(
      "kpiMemTop",
      formatNumber(topMem.mem) + "%"
    );

    setText(
      "kpiMemPid",
      topMem.pid
    );

    setText(
      "kpiMemRss",
      formatBytes(topMem.rss)
    );

    setBar(
      "barMemTop",
      topMem.mem || 0,
      100
    );
  }

  /* ================================
     BARRAS
     ================================ */
  setBar(
    "barTotal",
    totalProcessos,
    300
  );

  setBar(
    "barThreads",
    totalThreads,
    5000
  );

  setBar(
    "barAnom",
    anomalies,
    10
  );
}

/* ================================
   RESUMO SERVIDOR
   ================================ */
function atualizarResumo(dados) {

  setText(
    "kvHost",
    "AWS Ubuntu Server"
  );

  setText(
    "kvOs",
    "Ubuntu Linux"
  );

  setText(
    "kvIp",
    "54.233.247.111"
  );

  setText(
    "kvUptime",
    formatUptime(dados.uptime)
  );

  setText(
    "kvLoad",
    formatNumber(dados.cpu, 1) + "%"
  );
}

/* ================================
   RENDER GERAL
   ================================ */
function renderizarTudo(dados) {

  listaGlobal =
    Array.isArray(dados.process_list)
      ? dados.process_list
      : [];

  const listaFiltrada =
    aplicarFiltros(listaGlobal);

  atualizarKpis(listaGlobal, dados);

  atualizarResumo(dados);

  renderizarServicos(listaGlobal);

  atualizarAlertas(listaGlobal);

  renderizarTop(listaGlobal);

  renderizarTabela(listaFiltrada);
}

/* ================================
   PRINCIPAL
   ================================ */
async function atualizarProcessos() {

  try {

    const resposta =
      await fetch(API_URL, {
        cache: "no-store"
      });

    if (!resposta.ok) {

      throw new Error(
        "Erro HTTP: " +
        resposta.status
      );
    }

    const dados =
      await resposta.json();

    const hora =
      new Date().toLocaleTimeString(
        "pt-BR",
        {
          hour12: false
        }
      );

    setText("lastUpdate", hora);

    setText(
      "dataSource",
      "Fonte: API FastAPI"
    );

    renderizarTudo(dados);

  } catch (erro) {

    console.error(
      "Erro ao atualizar processos:",
      erro
    );

    const tbody =
      getEl("procTbody");

    if (tbody) {

      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="loading">
            Não foi possível carregar os dados da API.
          </td>
        </tr>
      `;
    }
  }
}

/* ================================
   EVENTOS
   ================================ */

/* Busca */
getEl("searchInput")
  ?.addEventListener("input", e => {

    searchTerm =
      e.target.value.toLowerCase();

    renderizarTabela(
      aplicarFiltros(listaGlobal)
    );
  });

/* Filtro estado */
getEl("stateFilter")
  ?.addEventListener("change", e => {

    stateFilterValue =
      e.target.value;

    renderizarTabela(
      aplicarFiltros(listaGlobal)
    );
  });

/* Filtro serviço */
getEl("serviceFilter")
  ?.addEventListener("change", e => {

    serviceFilterValue =
      e.target.value;

    renderizarTabela(
      aplicarFiltros(listaGlobal)
    );
  });

/* Top CPU */
getEl("btnTopCpu")
  ?.addEventListener("click", () => {

    modoTop = "cpu";

    getEl("btnTopCpu")
      ?.classList.remove("outline");

    getEl("btnTopMem")
      ?.classList.add("outline");

    renderizarTop(listaGlobal);
  });

/* Top RAM */
getEl("btnTopMem")
  ?.addEventListener("click", () => {

    modoTop = "mem";

    getEl("btnTopMem")
      ?.classList.remove("outline");

    getEl("btnTopCpu")
      ?.classList.add("outline");

    renderizarTop(listaGlobal);
  });

/* Refresh */
getEl("btnRefresh")
  ?.addEventListener(
    "click",
    atualizarProcessos
  );

/* ================================
   INIT
   ================================ */
document.addEventListener(
  "DOMContentLoaded",
  () => {

    atualizarProcessos();

    setInterval(
      atualizarProcessos,
      INTERVALO
    );
  }
);