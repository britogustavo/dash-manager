// ==========================================
// 1. JSON SIMULADO DO SERVIDOR C
// ==========================================
// Lista de processos e recursos sendo monitorados
const dadosMonitoramento = [
    {
        id: 1,
        titulo: "Temperatura da CPU",
        mensagem: "A temperatura da CPU excedeu o limite máximo seguro, reduzindo o tempo de vida do equipamento.",
        valor: 85, // => Vai gerar alerta (CRÍTICO)
        unidade: "°C",
        processo: "hardware_sensor",
        hora: "10:28:17",
        icone: "fa-temperature-half"
    },
    {
        id: 2,
        titulo: "Uso de Memória RAM",
        mensagem: "O consumo de memória atingiu níveis preocupantes. Possível vazamento de memória detectado.",
        valor: 92, // => Vai gerar alerta (CRÍTICO)
        unidade: "%",
        processo: "java_backend",
        hora: "10:15:00",
        icone: "fa-memory"
    },
    {
        id: 3,
        titulo: "Armazenamento do Disco",
        mensagem: "Espaço em disco livre na partição /var está abaixo do recomendado.",
        valor: 81, // => Vai gerar alerta (AVISO)
        unidade: "%",
        processo: "mysql_daemon",
        hora: "09:45:22",
        icone: "fa-hard-drive"
    },
    {
        id: 4,
        titulo: "Carga da CPU",
        mensagem: "Processador operando com folga.",
        valor: 45, // => NÃO VAI GERAR ALERTA (Abaixo de 80)
        unidade: "%",
        processo: "system",
        hora: "09:30:10",
        icone: "fa-microchip"
    }
];

// ==========================================
// 2. FUNÇÃO QUE CRIA O CARD DE ALERTA NO HTML
// ==========================================
function criarCardHTML(alerta) {
    // Define se é crítico (>= 90) ou aviso (80 a 89)
    const isCritico = alerta.valor >= 90 || alerta.titulo.includes("Temperatura");
    
    // Classes de cores e ícones baseadas na severidade
    const badgeClass = isCritico ? "critical" : "warning";
    const badgeText = isCritico ? "Crítico" : "Aviso";
    const badgeIcon = isCritico ? "fa-circle-exclamation" : "fa-triangle-exclamation";
    
    // Cor do ícone grande no card (vermelho ou amarelo)
    const corIconeMain = isCritico ? "color: var(--danger); background: var(--danger-bg);" 
                                   : "color: var(--yellow); background: var(--warning-bg);";

    return `
        <div class="alert-card">
            <div class="alert-card-header">
                <div class="alert-icon-main" style="${corIconeMain}">
                    <i class="fa-solid ${alerta.icone}"></i>
                </div>
                <span class="alert-badge ${badgeClass}">
                    <i class="fa-solid ${badgeIcon}"></i> ${badgeText}
                </span>
            </div>
            
            <h4>${alerta.titulo}</h4>
            <p>${alerta.mensagem}</p>
            
            <div class="alert-footer">
                <div class="alert-time">
                    <i class="fa-regular fa-clock"></i> ${alerta.hora} &bull; Hoje
                </div>
                <div class="alert-value" style="color: ${isCritico ? 'var(--danger)' : 'var(--yellow)'}">
                    Registro: ${alerta.valor}${alerta.unidade}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 3. RENDERIZAÇÃO E FILTRO DOS 80%
// ==========================================
function carregarAlertas() {
    const container = document.getElementById('alerts-grid');
    container.innerHTML = ''; // Limpa

    // REGRA DE NEGÓCIO: Só itens com valor >= 80
    const alertasValidos = dadosMonitoramento.filter(item => item.valor >= 80);

    // Atualiza o sininho de notificação no topo
    document.getElementById('badge-count').innerText = alertasValidos.length;

    if (alertasValidos.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1/-1;">Nenhuma anomalia detectada. Servidor operando em condições ideais.</p>';
        return;
    }

    // Injeta os cards filtrados na tela
    alertasValidos.forEach(alerta => {
        container.innerHTML += criarCardHTML(alerta);
    });
}

// ==========================================
// 4. ATUALIZAR RELÓGIO
// ==========================================
function atualizarRelogio() {
    document.getElementById('hora-atual').innerText = new Date().toLocaleTimeString('pt-BR');
}

// Inicialização da página
window.onload = () => {
    carregarAlertas();
    setInterval(atualizarRelogio, 1000);
    atualizarRelogio();
};

/* 
==================================================
COMO INTEGRAR COM O C EM TEMPO REAL:
==================================================
function buscarAlertasEmTempoReal() {
    fetch('http://seu-servidor-c/api/processos')
        .then(res => res.json())
        .then(dados => {
            const container = document.getElementById('alerts-grid');
            container.innerHTML = '';
            
            const alertas = dados.filter(item => item.valor >= 80);
            document.getElementById('badge-count').innerText = alertas.length;
            
            alertas.forEach(alerta => {
                container.innerHTML += criarCardHTML(alerta);
            });
        });
}
// setInterval(buscarAlertasEmTempoReal, 5000);
*/