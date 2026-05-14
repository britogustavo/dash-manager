async function atualizarProcessos() {
  try {
    const resposta = await fetch("../../../Backend/dados.json?ts=" + new Date().getTime());

    if (!resposta.ok) {
      throw new Error("Erro HTTP: " + resposta.status);
    }

    const dados = await resposta.json();

    // ===== Última atualização =====
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR", { hour12: false });
    const lastUpdateEl = document.getElementById("lastUpdate");
    if (lastUpdateEl) lastUpdateEl.innerText = hora;

    const dataSourceEl = document.getElementById("dataSource");
    if (dataSourceEl) dataSourceEl.innerText = "Fonte: ../../../Backend/dados.json";

    // ===== Process list (seguro) =====
    const lista = Array.isArray(dados.process_list) ? dados.process_list : [];

    // Helpers para estados: seu JSON pode vir "S (sleeping)" então pegamos a letra
    const stateLetter = (stateStr) => {
      const s = String(stateStr || "").trim();
      return s ? s.charAt(0).toUpperCase() : "-";
    };

    // ===== KPIs =====
    // total processos no host (se existir, usa; senão, usa tamanho da lista)
    const totalProcs = (typeof dados.processes === "number") ? dados.processes : lista.length;
    const totalThreads = (typeof dados.threads === "number") ? dados.threads : 0;

    const running = lista.filter(p => stateLetter(p.state) === "R").length;
    const zombies = lista.filter(p => stateLetter(p.state) === "Z").length;

    // IDs do seu HTML de processos atual:
    // kpiTotal, kpiRunning, kpiThreads, kpiThreadsAvg, kpiAnomalias, kpiZombie
    const kpiTotal = document.getElementById("kpiTotal");
    if (kpiTotal) kpiTotal.innerText = totalProcs;

    const kpiRunning = document.getElementById("kpiRunning");
    if (kpiRunning) kpiRunning.innerText = running;

    const kpiThreads = document.getElementById("kpiThreads");
    if (kpiThreads) kpiThreads.innerText = totalThreads;

    const kpiThreadsAvg = document.getElementById("kpiThreadsAvg");
    if (kpiThreadsAvg) {
      const avg = totalProcs > 0 ? (totalThreads / totalProcs) : 0;
      kpiThreadsAvg.innerText = avg.toFixed(1);
    }

    // Anomalias: aqui usamos zumbis como “crítico” e processos parados como “warning”
    const stopped = lista.filter(p => stateLetter(p.state) === "T").length;
    const anomalies = zombies + stopped;

    const kpiAnom = document.getElementById("kpiAnomalias");
    if (kpiAnom) kpiAnom.innerText = anomalies;

    const kpiZombie = document.getElementById("kpiZombie");
    if (kpiZombie) kpiZombie.innerText = zombies;

    // ===== Barras (se existirem no HTML) =====
    const barTotal = document.getElementById("barTotal");
    if (barTotal) {
      const ref = 300; // referência se você não tiver limite
      barTotal.style.width = Math.min(100, (totalProcs / ref) * 100) + "%";
    }

    const barThreads = document.getElementById("barThreads");
    if (barThreads) {
      const ref = 5000;
      barThreads.style.width = Math.min(100, (totalThreads / ref) * 100) + "%";
    }

    const barAnom = document.getElementById("barAnom");
    if (barAnom) {
      barAnom.style.width = Math.min(100, (anomalies / 10) * 100) + "%";
    }

    // ===== “Top processos (CPU / RAM)” -> como não há CPU/MEM por processo no JSON,
    // a melhor métrica disponível é: TOP por THREADS (mostrando PID).
    // Vamos preencher a mini-table (topTable) com base em threads.
    const topTable = document.getElementById("topTable");
    if (topTable) {
      const top = [...lista]
        .sort((a, b) => (b.threads || 0) - (a.threads || 0))
        .slice(0, 8);

      if (!top.length) {
        topTable.innerHTML = `<div class="muted">Sem dados de processos.</div>`;
      } else {
        topTable.innerHTML = top.map(p => {
          const pid = p.pid ?? "--";
          const name = p.name ?? "(desconhecido)";
          const th = p.threads ?? 0;
          const st = stateLetter(p.state);

          return `
            <div class="mini-row">
              <div class="mini-proc">
                <strong title="${name}">${name}</strong>
                <span>PID ${pid} • Estado ${st}</span>
              </div>
              <div class="mini-badge">${st}</div>
              <div class="mini-num">${th} th</div>
              <div class="mini-num">--</div>
            </div>
          `;
        }).join("");
      }
    }

    // ===== Tabela principal =====
    const tbody = document.getElementById("procTbody");
    if (tbody) {
      if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="10" class="loading">Sem processos para exibir.</td></tr>`;
      } else {
        // preencher colunas que existem; CPU/MEM/RSS/etime/cmd não existem no JSON atual
        tbody.innerHTML = lista.map(p => {
          const pid = p.pid ?? "--";
          const name = p.name ?? "(desconhecido)";
          const threads = p.threads ?? 0;
          const st = stateLetter(p.state);
          const stateText = p.state ?? "--";

          return `
            <tr>
              <td>${pid}</td>
              <td>${name}</td>
              <td>--</td>
              <td><span class="state-pill ${st.toLowerCase()}">${st}</span></td>
              <td>--</td>
              <td>--</td>
              <td>--</td>
              <td>${threads}</td>
              <td>--</td>
              <td class="cmd" title="${stateText}">${stateText}</td>
            </tr>
          `;
        }).join("");
      }
    }

    // ===== Último alerta (se existir bloco no HTML) =====
    // Se houver zumbis -> crítico; se houver stopped -> warning; senão sem alertas
    const lastAlertTitle = document.getElementById("lastAlertTitle");
    const lastAlertDesc = document.getElementById("lastAlertDesc");
    const lastAlertTime = document.getElementById("lastAlertTime");
    const lastAlertPid = document.getElementById("lastAlertPid");
    const lastAlertBadge = document.getElementById("lastAlertBadge");
    const lastAlertSeverity = document.getElementById("lastAlertSeverity");

    if (lastAlertTitle && lastAlertDesc && lastAlertTime && lastAlertPid && lastAlertBadge && lastAlertSeverity) {
      if (zombies > 0) {
        lastAlertBadge.style.display = "inline-flex";
        lastAlertBadge.classList.add("critical");
        lastAlertBadge.classList.remove("warning");
        lastAlertSeverity.innerText = "Crítico";
        lastAlertTitle.innerText = "Processo zumbi detectado";
        lastAlertDesc.innerText = `Há ${zombies} processo(s) em estado Z.`;
        lastAlertTime.innerText = hora;
        lastAlertPid.innerText = "PID: --";
      } else if (stopped > 0) {
        lastAlertBadge.style.display = "inline-flex";
        lastAlertBadge.classList.add("warning");
        lastAlertBadge.classList.remove("critical");
        lastAlertSeverity.innerText = "Atenção";
        lastAlertTitle.innerText = "Processo parado detectado";
        lastAlertDesc.innerText = `Há ${stopped} processo(s) em estado T.`;
        lastAlertTime.innerText = hora;
        lastAlertPid.innerText = "PID: --";
      } else {
        lastAlertBadge.style.display = "none";
        lastAlertTitle.innerText = "Sem alertas";
        lastAlertDesc.innerText = "Nenhum evento crítico registrado nas últimas leituras.";
        lastAlertTime.innerText = "--";
        lastAlertPid.innerText = "PID: --";
      }
    }

  } catch (erro) {
    console.error("Erro ao atualizar processos:", erro);

    const tbody = document.getElementById("procTbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="loading">
        Não foi possível carregar ../../../Backend/dados.json. Verifique servidor local e caminho.
      </td></tr>`;
    }
  }
}

// Atualiza a cada 5s (igual ao seu padrão)
setInterval(atualizarProcessos, 5000);
atualizarProcessos();