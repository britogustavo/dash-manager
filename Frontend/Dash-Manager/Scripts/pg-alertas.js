// ==========================================
// 1. FUNÇÃO PARA BUSCAR DADOS DO BACKEND (C)
// ==========================================

function buscarAlertasEmTempoReal() {
    // Faz uma requisição para o arquivo onde o C despeja os dados (simulado como JSON)
    fetch('./backend/extracao.c')
        .then(res => res.json()) // Converte a resposta bruta em um objeto JS que a gente entende
        .then(dados => {
            // Pega o container onde os cards vão aparecer lá no HTML
            const container = document.getElementById('alerts-grid');
            container.innerHTML = ''; // Limpa tudo o que tinha antes pra não duplicar
            
            // Filtra os dados: Só passa pra frente o que tiver uso igual ou maior que 80%
            const alertas = dados.filter(item => item.valor >= 80);
            
            // Atualiza o número de alertas lá no sininho (badge) do cabeçalho
            document.getElementById('badge-count').innerText = alertas.length;
            
            // Para cada alerta que passou no filtro, chama a função de criar o card e joga na tela
            alertas.forEach(alerta => {
                container.innerHTML += criarCardHTML(alerta);
            });
        });
}

// ==========================================
// 2. FUNÇÃO QUE MONTA O DESIGN DO CARD (HTML)
// ==========================================

function criarCardHTML(alerta) {
    // Lógica de severidade: se o valor for >= 90 ou tiver "Temperatura" no nome, o bagulho é doido (crítico)
    const isCritico = alerta.valor >= 90 || alerta.titulo.includes("Temperatura");
    
    // Define as classes CSS e os textos dependendo se é Crítico ou apenas um Aviso (80-89%)
    const badgeClass = isCritico ? "critical" : "warning";
    const badgeText = isCritico ? "Crítico" : "Aviso";
    const badgeIcon = isCritico ? "fa-circle-exclamation" : "fa-triangle-exclamation";
    
    // Escolhe as cores do ícone principal baseado na gravidade (Vermelho pra crítico, Amarelo pra aviso)
    const corIconeMain = isCritico ? "color: var(--danger); background: var(--danger-bg);" 
                                   : "color: var(--yellow); background: var(--warning-bg);";

    // Retorna a estrutura HTML do card preenchida com as variáveis do objeto 'alerta'
    return `
        <div class="alert-card">
            <div class="alert-card-header">
                <!-- Ícone dinâmico que vem do JSON (ex: processador, memória) -->
                <div class="alert-icon-main" style="${corIconeMain}">
                    <i class="fa-solid ${alerta.icone}"></i>
                </div>
                <!-- Selo de status (Crítico/Aviso) -->
                <span class="alert-badge ${badgeClass}">
                    <i class="fa-solid ${badgeIcon}"></i> ${badgeText}
                </span>
            </div>
            
            <h4>${alerta.titulo}</h4> <!-- Nome do componente monitorado -->
            <p>${alerta.mensagem}</p> <!-- Descrição do que está rolando -->
            
            <div class="alert-footer">
                <div class="alert-time">
                    <i class="fa-regular fa-clock"></i> ${alerta.hora} &bull; Hoje
                </div>
                <!-- Exibe o valor do recurso (ex: 85%) com a cor correspondente -->
                <div class="alert-value" style="color: ${isCritico ? 'var(--danger)' : 'var(--yellow)'}">
                    Registro: ${alerta.valor}${alerta.unidade}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 3. RENDERIZAÇÃO DOS DADOS LOCAIS (FALLBACK)
// ==========================================

function carregarAlertas() {
    const container = document.getElementById('alerts-grid');
    container.innerHTML = ''; // Limpa o grid de alertas

    // REGRA DE NEGÓCIO: Filtra apenas anomalias (uso de hardware >= 80%)
    const alertasValidos = dadosMonitoramento.filter(item => item.valor >= 80);

    // Atualiza o contador de notificações no topo da página
    document.getElementById('badge-count').innerText = alertasValidos.length;

    // Se não tiver nenhum alerta, avisa que o servidor tá suave (operando em condições ideais)
    if (alertasValidos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Nenhuma anomalia detectada. Servidor operando em condições ideais.</p>';
        return;
    }

    // Percorre a lista de alertas filtrados e renderiza cada um deles
    alertasValidos.forEach(alerta => {
        container.innerHTML += criarCardHTML(alerta);
    });
}

// ==========================================
// 4. ATUALIZAR RELÓGIO EM TEMPO REAL
// ==========================================

function atualizarRelogio() {
    // Pega a hora atual do sistema e formata no padrão brasileiro (HH:MM:SS)
    document.getElementById('hora-atual').innerText = new Date().toLocaleTimeString('pt-BR');
}

// Inicialização: Roda quando a janela termina de carregar
window.onload = () => {
    carregarAlertas(); // Carrega os alertas iniciais
    setInterval(atualizarRelogio, 1000); // Faz o relógio atualizar a cada 1 segundo (1000ms)
    atualizarRelogio(); // Chama uma vez pra não começar com o campo vazio
};

// Busca os dados do C sozinho a cada 5 segundos
setInterval(buscarAlertasEmTempoReal, 5000);