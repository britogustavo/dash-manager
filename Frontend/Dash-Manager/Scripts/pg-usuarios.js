/* ============================================================
   pg-usuarios.js — DashManager | Página de Usuários
   ============================================================ */

'use strict';

/* ---------- Dados de exemplo ---------- */
 let usuariosData = [];
const
/* ---------- Helpers ---------- */
function getInitials(nome) {
  const parts = nome.trim().split(' ');
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : nome.slice(0, 2).toUpperCase();
}

const avatarColors = [
  '#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16'
];
function getAvatarColor(id) {
  return avatarColors[id % avatarColors.length];
}

/* ---------- Renderização da tabela ---------- */
function renderTable(dados) {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  if (dados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 32px; color: var(--text-muted);">
          <i class="fa-solid fa-users-slash" style="font-size:24px; display:block; margin-bottom:8px;"></i>
          Nenhum usuário encontrado.
        </td>
      </tr>`;
    document.getElementById('tableInfo').textContent = '0 usuários encontrados';
    return;
  }

  dados.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="td-user">
          <div class="td-avatar" style="background:${getAvatarColor(u.id)}">${getInitials(u.nome)}</div>
          <span class="td-name">${u.nome}</span>
        </div>
      </td>
      <td style="color: var(--text-secondary)">${u.email}</td>
      <td>${u.cargo}</td>
      <td><span class="status-badge ${u.status}">${u.status === 'online' ? 'Online' : 'Offline'}</span></td>
      <td style="color: var(--text-secondary)">${u.ultimo}</td>
      <td>
        <div class="td-actions">
          <button class="action-btn" title="Ver perfil"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
          <button class="action-btn del" title="Remover"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('tableInfo').textContent =
    `Exibindo ${dados.length} de ${usuariosData.length} usuário${usuariosData.length !== 1 ? 's' : ''}`;
}

/* ---------- Cards de resumo ---------- */
function atualizarCards(dados) {
  const online  = dados.filter(u => u.status === 'online').length;
  const offline = dados.filter(u => u.status === 'offline').length;
  const admins  = dados.filter(u => u.cargo.toLowerCase().includes('admin')).length;

  animarNumero('totalUsuarios', dados.length);
  animarNumero('usuariosOnline', online);
  animarNumero('usuariosOffline', offline);
  animarNumero('totalAdmins', admins);
}

function animarNumero(id, destino) {
  const el = document.getElementById(id);
  if (!el) return;
  let atual = 0;
  const passo = Math.max(1, Math.floor(destino / 20));
  const intervalo = setInterval(() => {
    atual = Math.min(atual + passo, destino);
    el.textContent = atual;
    if (atual >= destino) clearInterval(intervalo);
  }, 40);
}

/* ---------- Filtros (busca + status) ---------- */
function aplicarFiltros() {
  const texto  = document.getElementById('searchInput').value.toLowerCase().trim();
  const status = document.getElementById('filterStatus').value;

  const filtrado = usuariosData.filter(u => {
    const matchTexto = !texto ||
      u.nome.toLowerCase().includes(texto) ||
      u.email.toLowerCase().includes(texto) ||
      u.cargo.toLowerCase().includes(texto);

    const matchStatus = status === 'todos' || u.status === status;

    return matchTexto && matchStatus;
  });

  renderTable(filtrado);
}



/* ---------- Init ---------- */
async function carregarUsuarios() {

  try {

    const resposta =
  fetch("../../Backend/dados.json?ts=" + new Date().getTime())

   const dados = await resposta.json();

console.log(dados);


    usuariosData = dados.process_list.map(processo => ({
      id: processo.pid,
      nome: processo.name,
      email: "PID " + processo.pid,
      cargo: processo.threads + " Threads",
      status: processo.state.includes("R") ? "online" : "offline",
      ultimo: processo.state
    }));

    atualizarCards(usuariosData);

    renderTable(usuariosData);

  } catch (erro) {

    console.error(erro);

  }
}

async function carregarUsuarios() {

  try {

    const resposta =
      await fetch("../Backend/dados.json?ts=" + new Date().getTime());

    if (!resposta.ok) {
      throw new Error("Erro ao carregar JSON");
    }

    const dados = await resposta.json();

    console.log(dados);

    usuariosData = dados.process_list.map(processo => ({
      id: processo.pid,
      nome: processo.name,
      email: "PID " + processo.pid,
      cargo: processo.threads + " Threads",
      status: processo.state.includes("R") ? "online" : "offline",
      ultimo: processo.state
    }));

    atualizarCards(usuariosData);

    renderTable(usuariosData);

  } catch (erro) {

    console.error("ERRO:", erro);

  }
}

document.addEventListener('DOMContentLoaded', () => {

  carregarUsuarios();

  setInterval(carregarUsuarios, 5000);

  document.getElementById('searchInput')
    .addEventListener('input', aplicarFiltros);

  document.getElementById('filterStatus')
    .addEventListener('change', aplicarFiltros);

});

  carregarUsuarios();

  setInterval(carregarUsuarios, 5000);

  document.getElementById('searchInput')
    .addEventListener('input', aplicarFiltros);

  document.getElementById('filterStatus')
    .addEventListener('change', aplicarFiltros);

