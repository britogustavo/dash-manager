# DashManager

Sistema de monitoramento de recursos do sistema operacional desenvolvido em linguagem C com integração Web utilizando HTML, CSS e JavaScript.

O projeto foi desenvolvido para integrar os conhecimentos das disciplinas de:

- Programação para Internet
- Linguagem de Programação
- Sistemas Operacionais

---

# 📌 Objetivo

O DashManager simula uma empresa especializada em monitoramento de sistemas computacionais para outras empresas.

A proposta do sistema é coletar informações do sistema operacional em tempo real utilizando linguagem C e exibir essas informações em um dashboard web moderno e interativo.

---

# 🚀 Tecnologias Utilizadas

## Backend
- Linguagem C
- Linux / WSL
- Arquivos do sistema `/proc`
- JSON

## Frontend
- HTML5
- CSS3
- JavaScript

---

# 🧠 Conceitos de Sistemas Operacionais Utilizados

O projeto utiliza informações fornecidas diretamente pelo Linux através de:

```text
/proc
/sys
```

Esses diretórios fornecem métricas em tempo real sobre o funcionamento do sistema operacional.

---

# 📊 Informações Monitoradas

O sistema realiza monitoramento de:

- Uso de CPU
- Memória RAM
- Espaço em disco
- Temperatura do sistema
- Rede
- Uptime
- Quantidade de processos
- Quantidade de threads
- Lista de processos

---

# 📁 Estrutura do Projeto

```text
dash_manager/
│
├── Backend/
│   ├── extracao.c
│   ├── monitor
│   └── dados.json
│
├── Frontend/
│   │
│   ├── Dash-Manager/
│   │   │
│   │   ├── Images/
│   │   │   └── .gitkeep
│   │   │
│   │   ├── Pages/
│   │   │   ├── pg-inicial.html
│   │   │   └── pg-alertas.html
│   │   │
│   │   ├── Scripts/
│   │   │   ├── pg-inicial.js
│   │   │   └── pg-alertas.js
│   │   │
│   │   └── Styles/
│   │       ├── pg-inicial.css
│   │       └── pg-alertas.css
│   │
│   ├── Exemplo do Tanizaka/
│   │   └── Exemplo utilizado para testes de leitura do JSON
│   │
│   └── Raiz-Urbana-Mercado/
│       │
│       ├── Images/
│       ├── Logos/
│       ├── Pages/
│       ├── Scripts/
│       └── Styles/
│
└── README.md
```

---

# ⚙️ Como Funciona

O programa em C realiza a coleta das informações do sistema a cada 5 segundos.

Após coletar os dados:
- as informações são convertidas para JSON
- o arquivo `dados.json` é atualizado
- o frontend lê o JSON utilizando JavaScript
- os dados são exibidos em tempo real no dashboard

---

# 🔄 Fluxo do Sistema

```text
Sistema Operacional
        ↓
Arquivos /proc e /sys
        ↓
Programa em C
        ↓
dados.json
        ↓
JavaScript
        ↓
Dashboard Web
```

---

# 🖥️ Métricas Extraídas

## CPU

Obtida através de:

```text
/proc/stat
```

Permite calcular:
- tempo ocioso
- tempo de uso
- porcentagem de utilização

---

## Memória RAM

Obtida através de:

```text
/proc/meminfo
```

Informações monitoradas:
- memória total
- memória utilizada
- memória disponível

---

## Disco

Obtido através do comando:

```bash
df -h /
```

Informações monitoradas:
- espaço total
- espaço utilizado
- espaço disponível
- porcentagem de uso

---

## Rede

Obtida através de:

```text
/proc/net/dev
```

Informações monitoradas:
- bytes recebidos (RX)
- bytes enviados (TX)
- taxa de download
- taxa de upload

---

## Temperatura

Obtida através de:

```text
/sys/class/thermal
```

Permite monitorar:
- temperatura do processador
- zonas térmicas do sistema

---

## Uptime

Obtido através de:

```text
/proc/uptime
```

Mostra:
- tempo em que o sistema permanece ligado

---

## Processos e Threads

Obtidos através de:

```text
/proc/[pid]
```

Informações monitoradas:
- PID
- nome do processo
- estado
- número de threads

---

# 🧪 Exemplo de JSON Gerado

```json
{
  "cpu": 12.45,

  "memory": {
    "total": 16384000,
    "used": 8450000,
    "available": 7934000
  },

  "disk": {
    "total": "500G",
    "used": "200G",
    "available": "300G",
    "usage_percent": "40%"
  },

  "temperature": 52.30,

  "uptime": 84231,

  "processes": 214,

  "threads": 1034,

  "network": {
    "rx": 23423423,
    "tx": 12312312,
    "rx_rate": 32423,
    "tx_rate": 18234
  }
}
```

---

# ▶️ Como Executar

## 1. Instalar GCC

No Linux/WSL:

```bash
sudo apt update
sudo apt install build-essential
```

---

## 2. Compilar o Projeto

Dentro da pasta Backend:

```bash
gcc extracao.c -o monitor
```

---

## 3. Executar

```bash
./monitor
```

O programa começará a atualizar o arquivo:

```text
dados.json
```

a cada 5 segundos.

---

# 🌐 Frontend

O frontend foi desenvolvido utilizando:
- HTML
- CSS
- JavaScript

O dashboard possui:
- tema escuro
- design moderno
- atualização dinâmica
- gráficos e cards de monitoramento

---

# 📄 Páginas do Sistema

## Dashboard
Visão geral do sistema.

## Recursos
Detalhamento completo de CPU, RAM, Disco e Rede.

## Processos
Exibição de processos e threads.

## Usuários
Usuários logados no sistema.

## Alertas
Alertas de temperatura e uso excessivo.

---

# 🏢 Proposta da Empresa

A DashManager simula uma empresa especializada em terceirização de monitoramento de sistemas computacionais.

A ideia é fornecer:
- acompanhamento em tempo real
- monitoramento de servidores
- alertas
- análise de desempenho
- gerenciamento de recursos

---

# 📚 Aprendizados do Projeto

Durante o desenvolvimento foram aplicados conceitos de:
- Sistemas Operacionais
- Gerenciamento de processos
- Threads
- Manipulação de arquivos
- JSON
- Backend em C
- Integração frontend/backend
- Linux
- Monitoramento de sistemas

---

# 👨‍💻 Desenvolvido por

Projeto acadêmico desenvolvido para fins educacionais.