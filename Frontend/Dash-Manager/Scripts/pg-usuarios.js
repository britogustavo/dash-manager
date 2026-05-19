/* =========================================
   PG-USUARIOS.JS — DashManager
   Corrigido e padronizado
   Mantém origem dos dados em Backend/dados.json
   ========================================= */

"use strict";

/* ================================
   CONFIGURAÇÕES
   ================================ */
const DADOS_URL = "../../../Backend/dados.json";
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

function stateLetter(state) {
  const value = String(state || "").trim();

  return value
    ? value.charAt(0).toUpperCase()
    : "-";
}

function getInitials(nome) {
  const cleanName = String(nome || "NA").trim();

  if (!cleanName) {
    return "NA";
  }

  const parts = cleanName.split(/\s+/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return cleanName.slice(0, 2).toUpperCase();
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
  const index = Math.abs(numericId) % avatarColors.length;

  return avatarColors[index];
}

/* ================================
   TRANSFORMAÇÃO DOS DADOS
   Mantém a origem atual:
   dados.process_list
   ================================ */
function normalizarUsuarios(dados) {
  const lista = Array.isArray(dados?.process_list)
    ? dados.process_list
    : [];

  return lista.map((processo, index) => {
    const pid = processo.pid ?? index;
    const nome = processo.name ?? "Processo desconhecido";
    const threads = processo.threads ?? 0;
    const estadoOriginal = processo.state ?? "--";
    const estado = stateLetter(estadoOriginal);

    return {
      id: pid,
      nome: nome,
      email: "PID " + pid,
      cargo: threads + " Threads",
      status: estado === "R" ? "online" : "offline",
      ultimo: estadoOriginal
    };
  });
}

/* ================================
   FILTROS
   ================================ */
function obterUsuariosFiltrados() {
  const searchInput = getEl("searchInput");
  const filterStatus = getEl("filterStatus");

  const texto = searchInput
    ? searchInput.value.toLowerCase().trim()
    : "";

  const status = filterStatus
    ? filterStatus.value
    : "todos";

  return usuariosData.filter(usuario => {
    const nome = String(usuario.nome || "").toLowerCase();
    const email = String(usuario.email || "").toLowerCase();
    const cargo = String(usuario.cargo || "").toLowerCase();
    const ultimo = String(usuario.ultimo || "").toLowerCase();

    const matchTexto =
      !texto ||
      nome.includes(texto) ||
      email.includes(texto) ||
      cargo.includes(texto) ||
      ultimo.includes(texto);

    const matchStatus =
      status === "todos" ||
      usuario.status === status;

    return matchTexto && matchStatus;
  });
}

function aplicarFiltros() {
  const filtrados = obterUsuariosFiltrados();

  renderTable(filtrados);
}

/* ================================
   CARDS DE RESUMO
   ================================ */
function atualizarCards(dados) {
  const total = dados.length;
  const online = dados.filter(usuario => usuario.status === "online").length;
  const offline = dados.filter(usuario => usuario.status === "offline").length;

  /*
    Mantém a lógica visual de "Administradores".
    Como a origem atual vem de process_list, normalmente será 0.
    Caso futuramente venha cargo real com "admin", já funciona.
  */
  const admins = dados.filter(usuario =>
    String(usuario.cargo || "").toLowerCase().includes("admin")
  ).length;

  setText("totalUsuarios", total);
  setText("usuariosOnline", online);
  setText("usuariosOffline", offline);
  setText("totalAdmins", admins);

  const onlinePercent = total > 0
    ? (online / total) * 100
    : 0;

  const offlinePercent = total > 0
    ? (offline / total) * 100
    : 0;

  const adminsPercent = total > 0
    ? (admins / total) * 100
    : 0;

  setBarWidth("barTotalUsuarios", Math.min(100, (total / 100) * 100));
  setBarWidth("barUsuariosOnline", onlinePercent);
  setBarWidth("barUsuariosOffline", offlinePercent);
  setBarWidth("barTotalAdmins", adminsPercent);
}

/* ================================
   RENDERIZAÇÃO DA TABELA
   ================================ */
function renderTable(dados) {
  const tbody = getEl("usersTableBody");

  if (!tbody) {
    return;
  }

  if (!dados.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="loading">
          <i class="fa-solid fa-users-slash" style="display:block; font-size:22px; margin-bottom:8px;"></i>
          Nenhum usuário encontrado.
        </td>
      </tr>
    `;

    setText("tableInfo", "0 registros encontrados");
    return;
  }

  tbody.innerHTML = dados.map(usuario => {
    const id = escapeHTML(usuario.id);
    const nome = escapeHTML(usuario.nome);
    const email = escapeHTML(usuario.email);
    const cargo = escapeHTML(usuario.cargo);
    const status = usuario.status === "online" ? "online" : "offline";
    const statusTexto = status === "online" ? "Online" : "Offline";
    const ultimo = escapeHTML(usuario.ultimo);
    const initials = escapeHTML(getInitials(usuario.nome));
    const avatarColor = getAvatarColor(usuario.id);

    return `
      <tr>
        <td>
          <div class="td-user">
            <div class="td-avatar" style="background:${avatarColor};">
              ${initials}
            </div>
            <span class="td-name" title="${nome}">
              ${nome}
            </span>
          </div>
        </td>

        <td style="color: var(--text-secondary);">
          ${email}
        </td>

        <td>
          ${cargo}
        </td>

        <td>
          <span class="status-badge ${status}">
            ${statusTexto}
          </span>
        </td>

        <td style="color: var(--text-secondary);">
          ${ultimo}
        </td>

        <td>
          <div class="td-actions">
            <button class="action-btn" type="button" title="Ver detalhes" data-id="${id}">
              <i class="fa-solid fa-eye"></i>
            </button>

            <button class="action-btn" type="button" title="Editar" data-id="${id}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>

            <button class="action-btn del" type="button" title="Remover" data-id="${id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  const total = usuariosData.length;
  const exibindo = dados.length;

  setText(
    "tableInfo",
    `Exibindo ${exibindo} de ${total} registro${total !== 1 ? "s" : ""}`
  );
}

/* ================================
   ÚLTIMA ATUALIZAÇÃO
   ================================ */
function atualizarHorario() {
  const agora = new Date();

  setText(
    "lastUpdate",
    agora.toLocaleTimeString("pt-BR", {
      hour12: false
    })
  );
}

/* ================================
   CARREGAMENTO DOS DADOS
   ================================ */
async function carregarUsuarios() {
  try {
    const resposta = await fetch(
      DADOS_URL + "?ts=" + new Date().getTime(),
      {
        cache: "no-store"
      }
    );

    if (!resposta.ok) {
      throw new Error("Erro HTTP: " + resposta.status);
    }

    const dados = await resposta.json();

    usuariosData = normalizarUsuarios(dados);

    atualizarCards(usuariosData);
    aplicarFiltros();
    atualizarHorario();

  } catch (erro) {
    console.error("Erro ao carregar usuários:", erro);

    const tbody = getEl("usersTableBody");

    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="loading">
            Não foi possível carregar ../../../Backend/dados.json.
            Verifique o servidor local e o caminho do arquivo.
          </td>
        </tr>
      `;
    }

    setText("tableInfo", "Erro ao carregar registros");
    setText("totalUsuarios", "--");
    setText("usuariosOnline", "--");
    setText("usuariosOffline", "--");
    setText("totalAdmins", "--");

    setBarWidth("barTotalUsuarios", 0);
    setBarWidth("barUsuariosOnline", 0);
    setBarWidth("barUsuariosOffline", 0);
    setBarWidth("barTotalAdmins", 0);
  }
}

/* ================================
   EVENTOS
   ================================ */
function configurarEventos() {
  const searchInput = getEl("searchInput");
  const filterStatus = getEl("filterStatus");

  if (searchInput) {
    searchInput.addEventListener("input", aplicarFiltros);
  }

  if (filterStatus) {
    filterStatus.addEventListener("change", aplicarFiltros);
  }
}

/* ================================
   INIT
   ================================ */
document.addEventListener("DOMContentLoaded", () => {
  configurarEventos();

  carregarUsuarios();

  setInterval(carregarUsuarios, INTERVALO_ATUALIZACAO);
});