/* =========================================
   PG-INICIAL.JS — DashManager
   Corrigido e padronizado
   Mantém endpoints e dados originais
   ========================================= */

"use strict";

/* ================================
   CONFIGURAÇÕES
   ================================ */
const API_METRICAS_URL = "http://54.233.247.111:8000/metricas";
const API_USUARIOS_URL = "http://54.233.247.111:8000/usuarios-online";

const INTERVALO_ATUALIZACAO = 5000;
const MAX_PONTOS_GRAFICO = 18;

/* ================================
   HISTÓRICO DOS MINI GRÁFICOS
   ================================ */
const historicoGraficos = {
  cpu: [],
  ram: [],
  disco: [],
  temperatura: []
};

/* ================================
   HELPERS
   ================================ */
function getEl(id) {
  return document.getElementById(id);
}

function clamp(valor, minimo = 0, maximo = 100) {
  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return minimo;
  }

  return Math.min(maximo, Math.max(minimo, numero));
}

function formatarNumero(valor, casas = 1) {
  const numero = Number(valor);

  if (Number.isNaN(numero)) {
    return "0.0";
  }

  return numero.toFixed(casas);
}

function normalizarCpu(cpu) {
  const valor = Number(cpu);

  if (Number.isNaN(valor)) {
    return 0;
  }

  /*
    Alguns endpoints retornam CPU como:
    0.35 = 35%
    Outros retornam:
    35 = 35%
  */
  if (valor <= 1) {
    return valor * 100;
  }

  return valor;
}

function extrairPercentual(valor) {
  if (typeof valor === "number") {
    return valor;
  }

  if (typeof valor === "string") {
    return Number(valor.replace("%", "").trim()) || 0;
  }

  return 0;
}

function definirTexto(id, texto) {
  const elemento = getEl(id);

  if (elemento) {
    elemento.innerText = texto;
  }
}

function definirLarguraBarra(id, percentual) {
  const elemento = getEl(id);

  if (!elemento) {
    return;
  }

  elemento.style.width = clamp(percentual, 0, 100) + "%";
}

/* ================================
   MINI GRÁFICOS SVG
   ================================ */
function adicionarPontoGrafico(tipo, valor) {
  if (!historicoGraficos[tipo]) {
    return;
  }

  historicoGraficos[tipo].push(clamp(valor, 0, 100));

  if (historicoGraficos[tipo].length > MAX_PONTOS_GRAFICO) {
    historicoGraficos[tipo].shift();
  }
}

function gerarPontosPolyline(valores) {
  if (!valores.length) {
    return "0,30 20,30 40,30 60,30 80,30 100,30";
  }

  const total = valores.length;
  const largura = 100;
  const altura = 40;
  const paddingTopo = 4;
  const paddingBaixo = 4;

  return valores
    .map((valor, index) => {
      const x = total === 1 ? 100 : (index / (total - 1)) * largura;

      /*
        Quanto maior o percentual, mais alto fica o ponto.
        SVG começa no topo, então precisa inverter.
      */
      const y =
        altura -
        paddingBaixo -
        (clamp(valor, 0, 100) / 100) * (altura - paddingTopo - paddingBaixo);

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function atualizarLinhaGrafico(idLinha, valores) {
  const linha = getEl(idLinha);

  if (!linha) {
    return;
  }

  linha.setAttribute("points", gerarPontosPolyline(valores));
}

function atualizarGraficos() {
  atualizarLinhaGrafico("cpuChartLine", historicoGraficos.cpu);
  atualizarLinhaGrafico("ramChartLine", historicoGraficos.ram);
  atualizarLinhaGrafico("diskChartLine", historicoGraficos.disco);
  atualizarLinhaGrafico("tempChartLine", historicoGraficos.temperatura);
}

/* ================================
   ALERTA
   ================================ */
function atualizarAlerta(dados, cpuPercentual, ramPercentual, discoPercentual, temperaturaValor) {
  let alerta = "Sistema funcionando normalmente";
  let classe = "normal";
  let statusTexto = "Normal";

  if (temperaturaValor !== null && temperaturaValor > 80) {
    alerta = "Temperatura elevada detectada";
    classe = "critical";
    statusTexto = "Crítico";
  }

  if (cpuPercentual > 90) {
    alerta = "Uso de CPU acima de 90%";
    classe = "critical";
    statusTexto = "Crítico";
  }

  if (ramPercentual > 90) {
    alerta = "Uso de RAM acima de 90%";
    classe = "critical";
    statusTexto = "Crítico";
  }

  if (discoPercentual >= 80 && classe !== "critical") {
    alerta = "Uso de disco acima de 80%";
    classe = "warning";
    statusTexto = "Atenção";
  }

  definirTexto("alert", alerta);

  const badge = getEl("alertBadge");

  if (badge) {
    badge.classList.remove("warning", "critical");

    if (classe === "warning") {
      badge.classList.add("warning");
    }

    if (classe === "critical") {
      badge.classList.add("critical");
    }

    const span = badge.querySelector("span");

    if (span) {
      span.innerText = statusTexto;
    }
  }
}

/* ================================
   BUSCA DE USUÁRIOS ONLINE
   ================================ */
async function buscarUsuariosOnline() {
  try {
    const respostaUsuarios = await fetch(API_USUARIOS_URL, {
      cache: "no-store"
    });

    if (!respostaUsuarios.ok) {
      throw new Error("Erro HTTP usuários: " + respostaUsuarios.status);
    }

    const dadosUsuarios = await respostaUsuarios.json();

    definirTexto(
      "usuarios-conectados",
      dadosUsuarios.usuarios_online ?? "--"
    );
  } catch (erro) {
    console.warn("Erro ao buscar usuários online:", erro);
    definirTexto("usuarios-conectados", "--");
  }
}

/* ================================
   ATUALIZAÇÃO PRINCIPAL
   ================================ */
async function atualizarDados() {
  try {
    const resposta = await fetch(API_METRICAS_URL, {
      cache: "no-store"
    });

    if (!resposta.ok) {
      throw new Error("Erro HTTP: " + resposta.status);
    }

    const dados = await resposta.json();

    /* ================================
       CPU
       ================================ */
    const cpuPercentual = normalizarCpu(dados.cpu);

    definirTexto("cpuPercentual", formatarNumero(cpuPercentual, 1) + "%");
    definirLarguraBarra("cpuBar", cpuPercentual);

    adicionarPontoGrafico("cpu", cpuPercentual);

    /* ================================
       RAM
       ================================ */
    const ramTotal = Number(dados?.memory?.total || 0) / 1024 / 1024;
    const ramUsada = Number(dados?.memory?.used || 0) / 1024 / 1024;
    const ramLivre = Number(dados?.memory?.available || 0) / 1024 / 1024;

    const ramPercentual =
      ramTotal > 0
        ? (ramUsada / ramTotal) * 100
        : 0;

    definirTexto("ramPercentual", formatarNumero(ramPercentual, 1));
    definirTexto("ramLivre", formatarNumero(ramLivre, 1));
    definirTexto("ramTotal", formatarNumero(ramTotal, 1));

    definirLarguraBarra("ramBar", ramPercentual);

    adicionarPontoGrafico("ram", ramPercentual);

    /* ================================
       DISCO
       ================================ */
    const discoPercentual = extrairPercentual(dados?.disk?.usage_percent);

    definirTexto("discoPercentual", formatarNumero(discoPercentual, 1) + "%");
    definirTexto("discoLivre", dados?.disk?.available ?? "--");
    definirTexto("discoTotal", dados?.disk?.total ?? "--");

    definirLarguraBarra("diskBar", discoPercentual);

    adicionarPontoGrafico("disco", discoPercentual);

    /* ================================
       UPTIME
       ================================ */
    const uptimeSegundos = Number(dados.uptime || 0);

    const dias = Math.floor(uptimeSegundos / 86400);
    const horas = Math.floor((uptimeSegundos % 86400) / 3600);
    const minutos = Math.floor((uptimeSegundos % 3600) / 60);

    let uptimeTexto = "";

    if (dias > 0) {
      uptimeTexto = `${dias}d ${horas}h ${minutos}min`;
    } else {
      uptimeTexto = `${horas}h ${minutos}min`;
    }

    definirTexto("uptime", uptimeTexto);

    /* ================================
       TEMPERATURA
       ================================ */
    const temperaturaBruta = Number(dados.temperature);
    let temperaturaValor = null;

    if (!Number.isNaN(temperaturaBruta) && temperaturaBruta >= 0) {
      temperaturaValor = temperaturaBruta;

      definirTexto("temperatura", temperaturaValor.toFixed(1) + "°C");
      definirLarguraBarra("tempBar", temperaturaValor);

      adicionarPontoGrafico("temperatura", temperaturaValor);
    } else {
      definirTexto("temperatura", "N/A");
      definirLarguraBarra("tempBar", 0);

      adicionarPontoGrafico("temperatura", 0);
    }

    /* ================================
       REDE
       ================================ */
    const downloadKBps = Number(dados?.network?.rx_rate || 0) / 1024;
    const uploadKBps = Number(dados?.network?.tx_rate || 0) / 1024;

    definirTexto("download-Mbps", downloadKBps.toFixed(2));
    definirTexto("upload-Mbps", uploadKBps.toFixed(2));

    /* ================================
       HORA ATUAL
       ================================ */
    definirTexto(
      "horaAtual",
      dados.current_time || new Date().toLocaleTimeString("pt-BR", { hour12: false })
    );

    /* ================================
       PROCESSOS
       ================================ */
    definirTexto("procesos-exec", dados.processes ?? "--");

    /* ================================
       USUÁRIOS ONLINE
       ================================ */
    buscarUsuariosOnline();

    /* ================================
       SISTEMA
       Mantido como estava no seu JS original
       ================================ */
    definirTexto("system", "Ubuntu 26.04 LTS");

    /* ================================
       IP
       Mantido como estava no seu JS original
       ================================ */
    definirTexto("ip", "54.233.247.111");

    /* ================================
       ALERTA
       ================================ */
    atualizarAlerta(
      dados,
      cpuPercentual,
      ramPercentual,
      discoPercentual,
      temperaturaValor
    );

    /* ================================
       MINI GRÁFICOS
       ================================ */
    atualizarGraficos();

  } catch (erro) {
    console.error("Erro ao atualizar dados:", erro);

    definirTexto("cpuPercentual", "Erro");
    definirTexto("ramPercentual", "--");
    definirTexto("discoPercentual", "--");
    definirTexto("uptime", "--");
    definirTexto("temperatura", "--");
    definirTexto("download-Mbps", "--");
    definirTexto("upload-Mbps", "--");
    definirTexto("procesos-exec", "--");
    definirTexto("usuarios-conectados", "--");
    definirTexto("alert", "Não foi possível carregar as métricas da API");

    const badge = getEl("alertBadge");

    if (badge) {
      badge.classList.remove("warning");
      badge.classList.add("critical");

      const span = badge.querySelector("span");

      if (span) {
        span.innerText = "Erro";
      }
    }
  }
}

/* ================================
   INIT
   ================================ */
document.addEventListener("DOMContentLoaded", () => {
  atualizarDados();
  setInterval(atualizarDados, INTERVALO_ATUALIZACAO);
});
