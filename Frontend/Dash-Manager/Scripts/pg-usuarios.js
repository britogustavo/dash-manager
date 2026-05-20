/* =========================================
   PG-USUARIOS.JS — DashManager
   Monitoramento de conexões/IPs
   ========================================= */

"use strict";

/* ================================
   CONFIGURAÇÕES
   ================================ */
const DADOS_URL = "http://54.233.247.111:8000/metricas";
const INTERVALO_ATUALIZACAO = 5000;

/* ================================
   ESTADO GLOBAL
   ================================ */
let usuariosData = [];

/* ================================
   HELPERS
   ================================ */
function getEl(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = getEl(id);

  if (el) {
    el.textContent = value;
  }
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function setBarWidth(id, value) {
  const el = getEl(id);

  if (!el) {
    return;
  }

  el.style.width = clamp(value, 0, 100) + "%";
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(ip) {

  const texto = String(ip || "--");

  return texto.slice(0, 2).toUpperCase();
}

const avatarColors = [
  "#3B82F6",
  "#22C55E",
  "#EAB308",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#84CC16"
];

function getAvatarColor(id) {

  const numericId = Number(id) || 0;

  const index =
    Math.abs(numericId) % avatarColors.length;

  return avatarColors[index];
}

/* ================================
   NORMALIZAÇÃO DOS DADOS
   AGORA USA:
   dados.users
   ================================ */
function normalizarUsuarios(dados) {

  const lista = Array.isArray(dados?.connected_users)
    ? dados.connected_users
    : [];

  return lista.map((usuario, index) => {

    const ip =
      usuario.ip || "Desconhecido";

    const protocolo =
      usuario.protocol || "--";

    const statusOriginal =
      usuario.status || "--";

    const porta =
      usuario.porta || "--";

    return {
      id: index + 1,

      nome: ip,

      email: protocolo.toUpperCase(),

      cargo: porta,

      status:
        statusOriginal === "ESTAB"
          ? "online"
          : "offline",

      ultimo: statusOriginal
    };
  });
}

/* ================================
   FILTROS
   ================================ */
function obterUsuariosFiltrados() {

  const searchInput =
    getEl("searchInput");

  const filterStatus =
    getEl("filterStatus");

  const texto =
    searchInput
      ? searchInput.value
          .toLowerCase()
          .trim()
      : "";

  const status =
    filterStatus
      ? filterStatus.value
      : "todos";

  return usuariosData.filter(usuario => {

    const nome =
      String(usuario.nome || "")
        .toLowerCase();

    const email =
      String(usuario.email || "")
        .toLowerCase();

    const cargo =
      String(usuario.cargo || "")
        .toLowerCase();

    const ultimo =
      String(usuario.ultimo || "")
        .toLowerCase();

    const matchTexto =
      !texto ||
      nome.includes(texto) ||
      email.includes(texto) ||
      cargo.includes(texto) ||
      ultimo.includes(texto);

    const matchStatus =
      status === "todos" ||
      usuario.status === status;

    return (
      matchTexto &&
      matchStatus
    );
  });
}

function aplicarFiltros() {

  const filtrados =
    obterUsuariosFiltrados();

  renderTable(filtrados);
}

/* ================================
   KPIs
   ================================ */
function atualizarCards(dados) {

  const total =
    dados.length;

  const online =
    dados.filter(usuario =>
      usuario.status === "online"
    ).length;

  const offline =
    dados.filter(usuario =>
      usuario.status === "offline"
    ).length;

  const ssh = usuariosData.filter(usuario => {

  const porta =
    String(usuario.cargo || "");

  return porta.endsWith(":22");

}).length;

  setText(
    "totalUsuarios",
    total
  );

  setText(
    "usuariosOnline",
    online
  );

  setText(
    "usuariosOffline",
    offline
  );

  setText(
    "totalAdmins",
    ssh
  );

  const onlinePercent =
    total > 0
      ? (online / total) * 100
      : 0;

  const offlinePercent =
    total > 0
      ? (offline / total) * 100
      : 0;

  const sshPercent =
    total > 0
      ? (ssh / total) * 100
      : 0;

  setBarWidth(
    "barTotalUsuarios",
    Math.min(100, total)
  );

  setBarWidth(
    "barUsuariosOnline",
    onlinePercent
  );

  setBarWidth(
    "barUsuariosOffline",
    offlinePercent
  );

  setBarWidth(
    "barTotalAdmins",
    sshPercent
  );
}

/* ================================
   RENDERIZAÇÃO TABELA
   ================================ */
function renderTable(dados) {

  const tbody =
    getEl("usersTableBody");

  if (!tbody) {
    return;
  }

  if (!dados.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading">

          <i class="fa-solid fa-users-slash"
             style="
               display:block;
               font-size:22px;
               margin-bottom:8px;
             ">
          </i>

          Nenhuma conexão encontrada.

        </td>
      </tr>
    `;

    setText(
      "tableInfo",
      "0 conexões encontradas"
    );

    return;
  }

  tbody.innerHTML =
    dados.map(usuario => {

      const id =
        escapeHTML(usuario.id);

      const nome =
        escapeHTML(usuario.nome);

      const email =
        escapeHTML(usuario.email);

      const cargo =
        escapeHTML(usuario.cargo);

      const status =
        usuario.status === "online"
          ? "online"
          : "offline";

      const statusTexto =
        status === "online"
          ? "Online"
          : "Offline";

      const ultimo =
        escapeHTML(usuario.ultimo);

      const initials =
        escapeHTML(
          getInitials(usuario.nome)
        );

      const avatarColor =
        getAvatarColor(usuario.id);

      return `
        <tr>

          <td>
            <div class="td-user">

              <div
                class="td-avatar"
                style="background:${avatarColor};"
              >
                ${initials}
              </div>

              <span
                class="td-name"
                title="${nome}"
              >
                ${nome}
              </span>

            </div>
          </td>

          <td
            style="
              color:
              var(--text-secondary);
            "
          >
            ${email}
          </td>

          <td>
            ${cargo}
          </td>

          <td>

            <span
              class="
                status-badge
                ${status}
              "
            >
              ${statusTexto}
            </span>

          </td>

          <td
            style="
              color:
              var(--text-secondary);
            "
          >
            ${ultimo}
          </td>

          <td>

            <div class="td-actions">

              <button
                class="action-btn"
                type="button"
                title="Ver detalhes"
                data-id="${id}"
              >
                <i class="fa-solid fa-eye"></i>
              </button>

              <button
                class="action-btn"
                type="button"
                title="Monitorar IP"
                data-id="${id}"
              >
                <i class="fa-solid fa-satellite-dish"></i>
              </button>

              <button
                class="action-btn del"
                type="button"
                title="Bloquear"
                data-id="${id}"
              >
                <i class="fa-solid fa-ban"></i>
              </button>

            </div>

          </td>

        </tr>
      `;
    }).join("");

  const total =
    usuariosData.length;

  const exibindo =
    dados.length;

  setText(
    "tableInfo",
    `Exibindo ${exibindo} de ${total} conexão${total !== 1 ? "ões" : ""}`
  );
}

/* ================================
   HORÁRIO
   ================================ */
function atualizarHorario() {

  const agora =
    new Date();

  setText(
    "lastUpdate",

    agora.toLocaleTimeString(
      "pt-BR",
      {
        hour12: false
      }
    )
  );
}

/* ================================
   CARREGAMENTO
   ================================ */
async function carregarUsuarios() {

  try {

    const resposta =
      await fetch(
        DADOS_URL
        + "?ts="
        + new Date().getTime(),

        {
          cache: "no-store"
        }
      );

    if (!resposta.ok) {

      throw new Error(
        "Erro HTTP: "
        + resposta.status
      );
    }

    const dados =
      await resposta.json();

    usuariosData =
      normalizarUsuarios(dados);

    atualizarCards(
      usuariosData
    );

    aplicarFiltros();

    atualizarHorario();

  } catch (erro) {

    console.error(
      "Erro ao carregar usuários:",
      erro
    );

    const tbody =
      getEl("usersTableBody");

    if (tbody) {

      tbody.innerHTML = `
        <tr>

          <td colspan="6" class="loading">

            Não foi possível carregar dados da API.

          </td>

        </tr>
      `;
    }

    setText(
      "tableInfo",
      "Erro ao carregar conexões"
    );

    setText(
      "totalUsuarios",
      "--"
    );

    setText(
      "usuariosOnline",
      "--"
    );

    setText(
      "usuariosOffline",
      "--"
    );

    setText(
      "totalAdmins",
      "--"
    );

    setBarWidth(
      "barTotalUsuarios",
      0
    );

    setBarWidth(
      "barUsuariosOnline",
      0
    );

    setBarWidth(
      "barUsuariosOffline",
      0
    );

    setBarWidth(
      "barTotalAdmins",
      0
    );
  }
}

/* ================================
   EVENTOS
   ================================ */
function configurarEventos() {

  const searchInput =
    getEl("searchInput");

  const filterStatus =
    getEl("filterStatus");

  if (searchInput) {

    searchInput.addEventListener(
      "input",
      aplicarFiltros
    );
  }

  if (filterStatus) {

    filterStatus.addEventListener(
      "change",
      aplicarFiltros
    );
  }
}

/* ================================
   INIT
   ================================ */
document.addEventListener(
  "DOMContentLoaded",
  () => {

    configurarEventos();

    carregarUsuarios();

    setInterval(
      carregarUsuarios,
      INTERVALO_ATUALIZACAO
    );
  }
);