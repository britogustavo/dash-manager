/* =========================================
   PG-PROCESSOS.JS — DashManager
   Corrigido e integrado com sua API real
   ========================================= */

"use strict";

/* ================================
   CONFIG
   ================================ */
const API_URL = "http://54.233.247.111:8000/metricas";
const INTERVALO = 5000;

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

function stateLetter(stateStr) {
  const s = String(stateStr || "").trim();

  return s ? s.charAt(0).toUpperCase() : "-";
}

function setBar(id, value, max = 100) {
  const el = getEl(id);

  if (!el) {
    return;
  }

  const pct =
    Math.min(100, (Number(value) / max) * 100);

  el.style.width = pct + "%";
}

/* ================================
   SERVIÇOS
   ================================ */
function detectarServico(nome) {

  const n = String(nome || "").toLowerCase();

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
   HEALTH DOS SERVIÇOS
   ================================ */
function renderizarServicos(lista) {

  const container = getEl("servicesList");

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
    new Date().toLocaleTimeString("pt-BR", {
      hour12: false
    });

  if (
    zombies > 0
  ) {

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

  if (
    stopped > 0
  ) {

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

  const top =
    [...lista]
      .sort((a, b) =>
        (b.threads || 0) -
        (a.threads || 0)
      )
      .slice(0, 8);

  if (!top.length) {

    topTable.innerHTML =
      `<div class="muted">
        Sem dados de processos.
      </div>`;

    return;
  }

  topTable.innerHTML =
    top.map(p => {

      const pid =
        p.pid ?? "--";

      const name =
        p.name ?? "--";

      const threads =
        p.threads ?? 0;

      const state =
        stateLetter(p.state);

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
            ${threads} th
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

      const threads =
        p.threads ?? 0;

      const state =
        stateLetter(p.state);

      const fullState =
        p.state ?? "--";

      return `
        <tr>

          <td>${pid}</td>

          <td>${name}</td>

          <td>root</td>

          <td>
            <span class="state-pill ${state.toLowerCase()}">
              ${state}
            </span>
          </td>

          <td>--</td>

          <td>--</td>

          <td>--</td>

          <td>${threads}</td>

          <td>--</td>

          <td class="cmd">
            ${fullState}
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
        "Erro HTTP: " + resposta.status
      );
    }

    const dados =
      await resposta.json();

    /* ================================
       HORA
       ================================ */
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

    /* ================================
       LISTA
       ================================ */
    const lista =
      Array.isArray(dados.process_list)
        ? dados.process_list
        : [];

    /* ================================
       KPIS
       ================================ */
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

    setText(
      "kpiTotal",
      totalProcessos
    );

    setText(
      "kpiRunning",
      running
    );

    setText(
      "kpiThreads",
      totalThreads
    );

    setText(
      "kpiThreadsAvg",
      totalProcessos > 0
        ? (totalThreads / totalProcessos).toFixed(1)
        : "0"
    );

    setText(
      "kpiAnomalias",
      anomalies
    );

    setText(
      "kpiZombie",
      zombies
    );

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

    /* ================================
       RESUMO
       ================================ */
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

    const up =
      Number(dados.uptime || 0);

    const dias =
      Math.floor(up / 86400);

    const horas =
      Math.floor((up % 86400) / 3600);

    const minutos =
      Math.floor((up % 3600) / 60);

    let uptimeTexto =
      `${horas}h ${minutos}m`;

    if (dias > 0) {
      uptimeTexto =
        `${dias}d ${horas}h ${minutos}m`;
    }

    setText(
      "kvUptime",
      uptimeTexto
    );

    setText(
      "kvLoad",
      formatNumber(dados.cpu, 1) + "%"
    );

    /* ================================
       RENDERIZAÇÕES
       ================================ */
    renderizarServicos(lista);

    atualizarAlertas(lista);

    renderizarTop(lista);

    renderizarTabela(lista);

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
   BOTÃO REFRESH
   ================================ */
document
  .getElementById("btnRefresh")
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