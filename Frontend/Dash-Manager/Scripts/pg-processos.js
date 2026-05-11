/* =========================================
   processos.js — DashManager (COMPLETO)
   Dashboard de Processos (Servidor de Site)
   Lê JSON gerado pelo coletor em C
   ========================================= */

(() => {
  "use strict";

  // ===== CONFIG =====
  const DATA_URL = "../data/processos.json"; // Ajuste se necessário
  const REFRESH_MS = 8000;                  // auto refresh
  const PAGE_SIZE = 15;
  const TOP_N = 8;

  const THRESHOLDS = {
    cpuWarn: 80,
    cpuCrit: 95,
    memWarn: 85,
    memCrit: 95,
    zombieAny: true
  };

  // ===== STATE =====
  const state = {
    raw: null,
    processes: [],
    filtered: [],
    page: 1,
    pageSize: PAGE_SIZE,
    sortKey: "cpu",
    sortDir: "desc",
    modeTop: "cpu", // cpu | mem
    history: { total: [], cpuTop: [], memTop: [], threads: [], anom: [] },
    timer: null,
    lastFetchAt: null
  };

  // ===== DOM =====
  const $ = (sel) => document.querySelector(sel);

  const els = {
    // header
    badgeAlerts: $("#badgeAlerts"),
    serverName: $("#serverName"),
    serverStatusDot: $("#serverStatusDot"),
    lastUpdate: $("#lastUpdate"),
    dataSource: $("#dataSource"),

    // KPI
    kpiTotal: $("#kpiTotal"),
    kpiRunning: $("#kpiRunning"),
    barTotal: $("#barTotal"),
    sparkTotal: $("#sparkTotal"),

    kpiCpuTop: $("#kpiCpuTop"),
    kpiCpuPeak: $("#kpiCpuPeak"),
    barCpuTop: $("#barCpuTop"),
    sparkCpu: $("#sparkCpu"),

    kpiMemTop: $("#kpiMemTop"),
    kpiMemRss: $("#kpiMemRss"),
    barMemTop: $("#barMemTop"),
    sparkMem: $("#sparkMem"),

    kpiThreads: $("#kpiThreads"),
    kpiThreadsAvg: $("#kpiThreadsAvg"),
    barThreads: $("#barThreads"),
    sparkThreads: $("#sparkThreads"),

    kpiAnomalias: $("#kpiAnomalias"),
    kpiZombie: $("#kpiZombie"),
    barAnom: $("#barAnom"),
    sparkAnom: $("#sparkAnom"),

    // lower grid
    btnTopCpu: $("#btnTopCpu"),
    btnTopMem: $("#btnTopMem"),
    topTable: $("#topTable"),

    btnRefresh: $("#btnRefresh"),
    kvHost: $("#kvHost"),
    kvOs: $("#kvOs"),
    kvIp: $("#kvIp"),
    kvUptime: $("#kvUptime"),
    kvLoad: $("#kvLoad"),
    kvWeb: $("#kvWeb"),
    kvDb: $("#kvDb"),
    kvCache: $("#kvCache"),
    servicesList: $("#servicesList"),

    // last alert
    lastAlertBadge: $("#lastAlertBadge"),
    lastAlertSeverity: $("#lastAlertSeverity"),
    lastAlertTitle: $("#lastAlertTitle"),
    lastAlertDesc: $("#lastAlertDesc"),
    lastAlertTime: $("#lastAlertTime"),
    lastAlertPid: $("#lastAlertPid"),

    // table controls
    searchInput: $("#searchInput"),
    stateFilter: $("#stateFilter"),
    serviceFilter: $("#serviceFilter"),

    // table
    procTable: $("#procTable"),
    procTbody: $("#procTbody"),
    pagination: $("#pagination"),
    rowsInfo: $("#rowsInfo"),
  };

  // ===== UTIL =====
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const safeNum = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  function toFixedSmart(n, decimals = 1) {
    const num = safeNum(n, 0);
    return num.toFixed(decimals).replace(/\.0$/, "");
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    const b = safeNum(bytes, 0);
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${toFixedSmart(kb, 1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${toFixedSmart(mb, 1)} MB`;
    const gb = mb / 1024;
    return `${toFixedSmart(gb, 2)} GB`;
  }

  function formatEtime(raw) {
    if (raw == null) return "--";
    const s = String(raw).trim();
    return s || "--";
  }

  function formatUptimeSeconds(sec) {
    const s = safeNum(sec, 0);
    if (!s) return "--";
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  }

  function nowTimeStr() {
    return new Date().toLocaleTimeString("pt-BR", { hour12: false });
  }

  function parseISOorDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function debounce(fn, ms = 250) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function setStatusDot(ok) {
    if (!els.serverStatusDot) return;
    els.serverStatusDot.style.background = ok ? "#22C55E" : "#EF4444";
    els.serverStatusDot.style.boxShadow = ok
      ? "0 0 0 3px rgba(34,197,94,0.12)"
      : "0 0 0 3px rgba(239,68,68,0.12)";
    els.serverStatusDot.title = ok ? "Online" : "Offline";
  }

  // ===== SERVICE CLASSIFICATION =====
  function classifyService(name, cmd) {
    const s = `${name || ""} ${cmd || ""}`.toLowerCase();

    if (/(nginx|apache2|httpd|caddy|traefik|haproxy|lighttpd)/.test(s)) return "web";
    if (/(redis-server|memcached|varnish|rabbitmq|kafka|celery)/.test(s)) return "cache";
    if (/(mysql|mysqld|mariadbd|postgres|postgresql|mongod|influxd|cockroach|cassandra)/.test(s)) return "db";
    if (/(redis)/.test(s)) return "cache";

    return "other";
  }

  // ===== NORMALIZE JSON =====
  function normalizeData(data) {
    const meta = data.meta || data.server || data.info || {};
    const limits = data.limits || {};
    const services = data.services || data.health || [];
    const alerts = data.alerts || data.events || [];

    const processesRaw = data.processes || data.procs || data.process_list || [];
    const processes = processesRaw.map((p) => {
      const pid = p.pid ?? p.PID ?? p.id;
      const name = p.name ?? p.proc ?? p.process ?? p.command_name ?? p.comm;
      const user = p.user ?? p.username ?? p.uid_name ?? p.owner;
      const stateP = p.state ?? p.st ?? p.status ?? p.s;
      const cpu = p.cpu ?? p.cpu_percent ?? p.cpuPct ?? p.pcpu;
      const mem = p.mem ?? p.mem_percent ?? p.memPct ?? p.pmem;

      // rss: aceita bytes, kb, string
      let rss = p.rss ?? p.rss_bytes ?? p.rssBytes ?? 0;
      if (p.rss_kb != null) rss = safeNum(p.rss_kb, 0) * 1024;
      rss = safeNum(rss, 0);

      const threads = p.threads ?? p.th ?? p.nlwp;
      const etime = p.etime ?? p.elapsed ?? p.uptime ?? p.et;
      const cmd = p.cmd ?? p.command ?? p.args ?? p.fullcmd ?? p.argv;
      const service = p.service ?? p.role ?? null;

      const resolvedService = service || classifyService(name, cmd);

      return {
        pid: safeNum(pid, 0),
        name: String(name ?? "").trim() || "(desconhecido)",
        user: String(user ?? "").trim() || "--",
        state: String(stateP ?? "").trim() || "--",
        cpu: safeNum(cpu, 0),
        mem: safeNum(mem, 0),
        rss,
        threads: safeNum(threads, 0),
        etime: formatEtime(etime),
        cmd: String(cmd ?? "").trim() || "--",
        service: resolvedService
      };
    });

    const history = data.history || data.series || {};
    const hist = {
      total: Array.isArray(history.total) ? history.total.map(Number) : [],
      cpuTop: Array.isArray(history.cpuTop) ? history.cpuTop.map(Number) : [],
      memTop: Array.isArray(history.memTop) ? history.memTop.map(Number) : [],
      threads: Array.isArray(history.threads) ? history.threads.map(Number) : [],
      anom: Array.isArray(history.anom) ? history.anom.map(Number) : []
    };

    return { meta, limits, services, alerts, processes, history: hist };
  }

  // ===== SPARKLINE SVG =====
  function renderSparkline(svgEl, values, strokeColor = "rgba(148,163,184,0.55)", fillColor = "rgba(148,163,184,0.12)") {
    if (!svgEl) return;

    const w = 120;
    const h = 36;

    const vals = (Array.isArray(values) ? values : []).map((v) => safeNum(v, 0));
    if (vals.length < 2) {
      svgEl.innerHTML = "";
      return;
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = (max - min) || 1;

    const step = w / (vals.length - 1);
    const points = vals.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return [x, y];
    });

    let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`;
    }
    const a = `${d} L ${w} ${h} L 0 ${h} Z`;

    svgEl.innerHTML = `
      <path class="fill" d="${a}" fill="${fillColor}"></path>
      <path d="${d}" stroke="${strokeColor}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>
    `;
  }

  function pushHistory(arr, value, maxLen = 24) {
    arr.push(value);
    while (arr.length > maxLen) arr.shift();
  }

  // ===== KPI CALC =====
  function computeKPIs(processes) {
    const total = processes.length;
    const running = processes.filter(p => p.state === "R").length;

    const topCpu = [...processes].sort((a, b) => b.cpu - a.cpu).slice(0, TOP_N);
    const cpuTopSum = topCpu.reduce((acc, p) => acc + p.cpu, 0);
    const cpuPeak = topCpu.length ? Math.max(...topCpu.map(p => p.cpu)) : 0;

    const topMem = [...processes].sort((a, b) => b.mem - a.mem).slice(0, TOP_N);
    const memTopSum = topMem.reduce((acc, p) => acc + p.mem, 0);
    const memRssSum = topMem.reduce((acc, p) => acc + p.rss, 0);

    const threadsTotal = processes.reduce((acc, p) => acc + p.threads, 0);
    const threadsAvg = total ? (threadsTotal / total) : 0;

    const zombies = processes.filter(p => p.state === "Z").length;
    const stopped = processes.filter(p => p.state === "T").length;

    const anomalies = [];
    for (const p of processes) {
      if (p.cpu >= THRESHOLDS.cpuCrit) anomalies.push({ severity: "critical", title: "CPU crítica", proc: p });
      else if (p.cpu >= THRESHOLDS.cpuWarn) anomalies.push({ severity: "warning", title: "CPU alta", proc: p });

      if (p.mem >= THRESHOLDS.memCrit) anomalies.push({ severity: "critical", title: "Memória crítica", proc: p });
      else if (p.mem >= THRESHOLDS.memWarn) anomalies.push({ severity: "warning", title: "Memória alta", proc: p });

      if (THRESHOLDS.zombieAny && p.state === "Z") anomalies.push({ severity: "critical", title: "Processo zumbi", proc: p });
      if (p.state === "T") anomalies.push({ severity: "warning", title: "Processo parado", proc: p });
    }

    return {
      total, running,
      cpuTopSum, cpuPeak,
      memTopSum, memRssSum,
      threadsTotal, threadsAvg,
      zombies, stopped,
      anomalies,
      topCpu, topMem
    };
  }

  function setBar(el, valuePct) {
    if (!el) return;
    el.style.width = `${clamp(valuePct, 0, 100)}%`;
  }

  function updateKPIs(kpis, limits = {}) {
    // Total
    els.kpiTotal && (els.kpiTotal.textContent = String(kpis.total));
    els.kpiRunning && (els.kpiRunning.textContent = String(kpis.running));

    const procLimit = safeNum(limits.processLimit ?? limits.maxProcesses ?? 0, 0);
    const cap = procLimit > 0 ? (kpis.total / procLimit) * 100 : clamp((kpis.total / 300) * 100, 0, 100);
    setBar(els.barTotal, cap);

    // CPU
    els.kpiCpuTop && (els.kpiCpuTop.textContent = `${toFixedSmart(kpis.cpuTopSum, 1)}%`);
    els.kpiCpuPeak && (els.kpiCpuPeak.textContent = `${toFixedSmart(kpis.cpuPeak, 1)}%`);
    setBar(els.barCpuTop, clamp(kpis.cpuTopSum, 0, 100));

    // MEM
    els.kpiMemTop && (els.kpiMemTop.textContent = `${toFixedSmart(kpis.memTopSum, 1)}%`);
    els.kpiMemRss && (els.kpiMemRss.textContent = formatBytes(kpis.memRssSum));
    setBar(els.barMemTop, clamp(kpis.memTopSum, 0, 100));

    // Threads
    els.kpiThreads && (els.kpiThreads.textContent = String(kpis.threadsTotal));
    els.kpiThreadsAvg && (els.kpiThreadsAvg.textContent = toFixedSmart(kpis.threadsAvg, 1));
    const thLimit = safeNum(limits.threadLimit ?? limits.maxThreads ?? 0, 0);
    const thCap = thLimit > 0 ? (kpis.threadsTotal / thLimit) * 100 : clamp((kpis.threadsTotal / 5000) * 100, 0, 100);
    setBar(els.barThreads, thCap);

    // Anomalias
    els.kpiAnomalias && (els.kpiAnomalias.textContent = String(kpis.anomalies.length));
    els.kpiZombie && (els.kpiZombie.textContent = String(kpis.zombies));
    setBar(els.barAnom, clamp((kpis.anomalies.length / 10) * 100, 0, 100));
  }

  function updateSparks(kpis, incomingHistory = null) {
    const hasIncoming = incomingHistory && (
      incomingHistory.total?.length ||
      incomingHistory.cpuTop?.length ||
      incomingHistory.memTop?.length
    );

    const hist = hasIncoming ? incomingHistory : state.history;

    if (!hasIncoming) {
      pushHistory(state.history.total, kpis.total);
      pushHistory(state.history.cpuTop, kpis.cpuTopSum);
      pushHistory(state.history.memTop, kpis.memTopSum);
      pushHistory(state.history.threads, kpis.threadsTotal);
      pushHistory(state.history.anom, kpis.anomalies.length);
    }

    renderSparkline(els.sparkTotal, hist.total);
    renderSparkline(els.sparkCpu, hist.cpuTop, "rgba(234,179,8,0.85)", "rgba(234,179,8,0.14)");
    renderSparkline(els.sparkMem, hist.memTop, "rgba(34,197,94,0.85)", "rgba(34,197,94,0.12)");
    renderSparkline(els.sparkThreads, hist.threads, "rgba(96,165,250,0.85)", "rgba(96,165,250,0.12)");
    renderSparkline(els.sparkAnom, hist.anom, "rgba(239,68,68,0.85)", "rgba(239,68,68,0.14)");
  }

  // ===== TOP TABLE =====
  function renderTopTable(kpis) {
    if (!els.topTable) return;

    const list = (state.modeTop === "cpu" ? kpis.topCpu : kpis.topMem);
    if (!list.length) {
      els.topTable.innerHTML = `<div class="muted">Sem dados de processos.</div>`;
      return;
    }

    const rows = list.map((p) => {
      const badge = state.modeTop === "cpu"
        ? `${toFixedSmart(p.cpu, 1)}% CPU`
        : `${toFixedSmart(p.mem, 1)}% MEM`;

      return `
        <div class="mini-row">
          <div class="mini-proc">
            <strong title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</strong>
            <span>PID ${p.pid} • ${escapeHtml(p.user)} • ${escapeHtml(p.service)}</span>
          </div>
          <div class="mini-badge">${escapeHtml(p.state)}</div>
          <div class="mini-num">${escapeHtml(badge)}</div>
          <div class="mini-num">${escapeHtml(formatBytes(p.rss))}</div>
        </div>
      `;
    }).join("");

    els.topTable.innerHTML = rows;
  }

  // ===== RESUMO SERVIDOR + SERVICES =====
  function updateServerSummary(meta = {}, services = [], processes = []) {
    // header server name
    const serverLabel = meta.serverName || meta.name || "Servidor - Loja 01";
    els.serverName && (els.serverName.textContent = serverLabel);

    // KV
    els.kvHost && (els.kvHost.textContent = meta.hostname || meta.host || "--");
    els.kvOs && (els.kvOs.textContent = meta.os || meta.distro || meta.system || "--");
    els.kvIp && (els.kvIp.textContent = meta.ip || meta.address || "--");

    const uptime = meta.uptimeSeconds != null ? formatUptimeSeconds(meta.uptimeSeconds) : (meta.uptime || "--");
    els.kvUptime && (els.kvUptime.textContent = uptime);

    const load = meta.loadAvg || meta.load || meta.loadavg;
    els.kvLoad && (els.kvLoad.textContent = load ? String(load) : "--");

    // Status "Web/DB/Cache" — tenta deduzir se não vier no JSON
    const web = meta.web || inferServiceFromProcs(processes, "web");
    const db = meta.db || inferServiceFromProcs(processes, "db");
    const cache = meta.cache || inferServiceFromProcs(processes, "cache");

    els.kvWeb && (els.kvWeb.textContent = String(web || "--"));
    els.kvDb && (els.kvDb.textContent = String(db || "--"));
    els.kvCache && (els.kvCache.textContent = String(cache || "--"));

    // services health list
    renderServicesList(services, processes);
  }

  function inferServiceFromProcs(processes, serviceName) {
    const any = processes.some(p => p.service === serviceName);
    return any ? "Ativo" : "—";
  }

  function renderServicesList(services, processes) {
    if (!els.servicesList) return;

    // Se não vier health pronto no JSON, gera básico a partir dos processos
    let list = Array.isArray(services) ? services : [];
    if (!list.length) {
      list = [
        { name: "Web server", key: "web", status: processes.some(p => p.service === "web") ? "ok" : "warn", message: "Detectado via processos" },
        { name: "Banco", key: "db", status: processes.some(p => p.service === "db") ? "ok" : "warn", message: "Detectado via processos" },
        { name: "Cache", key: "cache", status: processes.some(p => p.service === "cache") ? "ok" : "warn", message: "Detectado via processos" },
      ];
    }

    const html = list.map((s) => {
      const name = s.name || s.service || s.key || "Serviço";
      const status = (s.status || s.health || "ok").toLowerCase(); // ok/warn/bad
      const msg = s.message || s.details || "";

      const pillClass = status === "bad" ? "bad" : status === "warn" ? "warn" : "ok";
      const pillText = status === "bad" ? "Offline" : status === "warn" ? "Atenção" : "OK";

      return `
        <div class="service-item">
          <div class="service-left">
            <i class="fa-solid fa-circle-nodes"></i>
            <strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong>
          </div>
          <div class="service-right">
            ${msg ? `<span title="${escapeHtml(msg)}">${escapeHtml(msg)}</span>` : ""}
            <span class="pill ${pillClass}">${pillText}</span>
          </div>
        </div>
      `;
    }).join("");

    els.servicesList.innerHTML = html || `<div class="muted">Sem dados de serviços.</div>`;
  }

  // ===== ALERTS =====
  function renderLastAlert(alerts = [], kpis = null) {
    // Se o JSON vier com alerts, usa o último; senão, gera a partir das anomalias
    let last = null;

    if (Array.isArray(alerts) && alerts.length) {
      // procura o mais recente por timestamp se houver
      last = [...alerts].sort((a, b) => {
        const da = parseISOorDate(a.time || a.timestamp || a.date);
        const db = parseISOorDate(b.time || b.timestamp || b.date);
        return (db?.getTime() || 0) - (da?.getTime() || 0);
      })[0];
    } else if (kpis && kpis.anomalies.length) {
      // cria um "alert" sintético do mais grave
      const crit = kpis.anomalies.find(x => x.severity === "critical") || kpis.anomalies[0];
      last = {
        severity: crit.severity,
        title: crit.title,
        description: `Processo ${crit.proc.name} (PID ${crit.proc.pid}) apresentou condição anormal.`,
        time: new Date().toISOString(),
        pid: crit.proc.pid
      };
    }

    // badge contador (notificações)
    const count = Array.isArray(alerts) ? alerts.length : (kpis?.anomalies?.length || 0);
    els.badgeAlerts && (els.badgeAlerts.textContent = String(count));

    if (!last) {
      // Sem alertas
      if (els.lastAlertBadge) els.lastAlertBadge.style.display = "none";
      els.lastAlertTitle && (els.lastAlertTitle.textContent = "Sem alertas");
      els.lastAlertDesc && (els.lastAlertDesc.textContent = "Nenhum evento crítico registrado nas últimas leituras.");
      els.lastAlertTime && (els.lastAlertTime.textContent = "--");
      els.lastAlertPid && (els.lastAlertPid.textContent = "PID: --");
      return;
    }

    // Com alerta
    const sev = String(last.severity || last.level || "warning").toLowerCase();
    const isCritical = sev === "critical" || sev === "crit" || sev === "high";

    if (els.lastAlertBadge) {
      els.lastAlertBadge.style.display = "inline-flex";
      els.lastAlertBadge.classList.remove("critical", "warning");
      els.lastAlertBadge.classList.add(isCritical ? "critical" : "warning");
    }

    els.lastAlertSeverity && (els.lastAlertSeverity.textContent = isCritical ? "Crítico" : "Atenção");
    els.lastAlertTitle && (els.lastAlertTitle.textContent = last.title || "Alerta");
    els.lastAlertDesc && (els.lastAlertDesc.textContent = last.description || last.message || "Evento detectado.");

    const d = parseISOorDate(last.time || last.timestamp || last.date);
    els.lastAlertTime && (els.lastAlertTime.textContent = d ? d.toLocaleTimeString("pt-BR", { hour12: false }) : nowTimeStr());
    els.lastAlertPid && (els.lastAlertPid.textContent = `PID: ${last.pid ?? last.processPid ?? "--"}`);
  }

  // ===== FILTER/SORT/PAGINATION =====
  function applyFilters() {
    const q = (els.searchInput?.value || "").trim().toLowerCase();
    const st = els.stateFilter?.value || "all";
    const svc = els.serviceFilter?.value || "all";

    let out = [...state.processes];

    if (q) {
      out = out.filter(p => {
        return (
          String(p.pid).includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.user.toLowerCase().includes(q) ||
          p.cmd.toLowerCase().includes(q)
        );
      });
    }

    if (st !== "all") {
      out = out.filter(p => p.state === st);
    }

    if (svc !== "all") {
      out = out.filter(p => p.service === svc);
    }

    state.filtered = out;
    state.page = 1;
  }

  function applySort() {
    const key = state.sortKey;
    const dir = state.sortDir === "asc" ? 1 : -1;

    const numKeys = new Set(["pid", "cpu", "mem", "rss", "threads"]);
    const textKeys = new Set(["name", "user", "state", "etime", "cmd", "service"]);

    state.filtered.sort((a, b) => {
      const va = a[key];
      const vb = b[key];

      if (numKeys.has(key)) {
        return (safeNum(va, 0) - safeNum(vb, 0)) * dir;
      }

      if (textKeys.has(key)) {
        return String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { sensitivity: "base" }) * dir;
      }

      return 0;
    });
  }

  function paginate(list) {
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = clamp(state.page, 1, pages);

    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    return { slice: list.slice(start, end), total, pages };
  }

  function renderPagination(total, pages) {
    if (!els.pagination) return;
    els.pagination.innerHTML = "";

    if (pages <= 1) return;

    const makeBtn = (label, page, active = false, disabled = false) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "page-btn" + (active ? " active" : "");
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener("click", () => {
        state.page = page;
        renderTable();
      });
      return btn;
    };

    // Prev
    els.pagination.appendChild(makeBtn("‹", state.page - 1, false, state.page === 1));

    // Window de páginas
    const windowSize = 5;
    let start = Math.max(1, state.page - Math.floor(windowSize / 2));
    let end = Math.min(pages, start + windowSize - 1);
    if (end - start < windowSize - 1) start = Math.max(1, end - windowSize + 1);

    for (let p = start; p <= end; p++) {
      els.pagination.appendChild(makeBtn(String(p), p, p === state.page));
    }

    // Next
    els.pagination.appendChild(makeBtn("›", state.page + 1, false, state.page === pages));
  }

  function statePill(stateChar) {
    const s = String(stateChar || "--").toUpperCase();
    let cls = "";
    if (s === "R") cls = "r";
    else if (s === "S") cls = "s";
    else if (s === "D") cls = "d";
    else if (s === "T") cls = "t";
    else if (s === "Z") cls = "z";
    return `<span class="state-pill ${cls}">${escapeHtml(s)}</span>`;
  }

  function renderTable() {
    if (!els.procTbody) return;

    applyFilters();
    applySort();

    const { slice, total, pages } = paginate(state.filtered);

    if (!slice.length) {
      els.procTbody.innerHTML = `<tr><td colspan="10" class="loading">Nenhum processo encontrado.</td></tr>`;
      els.rowsInfo && (els.rowsInfo.textContent = `0 de 0`);
      renderPagination(total, pages);
      return;
    }

    els.procTbody.innerHTML = slice.map((p) => {
      return `
        <tr>
          <td>${p.pid}</td>
          <td title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.user)}</td>
          <td>${statePill(p.state)}</td>
          <td>${toFixedSmart(p.cpu, 1)}</td>
          <td>${toFixedSmart(p.mem, 1)}</td>
          <td>${escapeHtml(formatBytes(p.rss))}</td>
          <td>${p.threads}</td>
          <td>${escapeHtml(p.etime)}</td>
          <td class="cmd" title="${escapeHtml(p.cmd)}">${escapeHtml(p.cmd)}</td>
        </tr>
      `;
    }).join("");

    const showingStart = (state.page - 1) * state.pageSize + 1;
    const showingEnd = Math.min(state.page * state.pageSize, total);
    els.rowsInfo && (els.rowsInfo.textContent = `${showingStart}-${showingEnd} de ${total}`);

    renderPagination(total, pages);
  }

  // ===== SORT HEADER HANDLER =====
  function initSortHeaders() {
    if (!els.procTable) return;
    const ths = els.procTable.querySelectorAll("thead th[data-key]");
    ths.forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-key");
        if (!key) return;

        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = (key === "name" || key === "user" || key === "cmd" || key === "state" || key === "etime") ? "asc" : "desc";
        }
        renderTable();
      });
    });
  }

  // ===== DATA FETCH + RENDER =====
  async function fetchData() {
    try {
      // cache-bust para garantir leitura do JSON novo
      const url = `${DATA_URL}?t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      state.lastFetchAt = new Date();
      setStatusDot(true);
      return json;
    } catch (err) {
      console.error("[processos.js] Erro no fetch:", err);
      setStatusDot(false);
      return null;
    }
  }

  function renderAll(normalized) {
    state.raw = normalized;
    state.processes = normalized.processes || [];
    state.filtered = [...state.processes];

    // last update header
    const metaTime = normalized.meta?.timestamp || normalized.meta?.generatedAt || normalized.meta?.time;
    const dt = parseISOorDate(metaTime);
    els.lastUpdate && (els.lastUpdate.textContent = dt ? dt.toLocaleTimeString("pt-BR", { hour12: false }) : nowTimeStr());
    els.dataSource && (els.dataSource.textContent = `Fonte: ${DATA_URL}`);

    // KPIs
    const kpis = computeKPIs(state.processes);
    updateKPIs(kpis, normalized.limits);

    // Sparks
    updateSparks(kpis, normalized.history);

    // Top table
    renderTopTable(kpis);

    // Server summary + services
    updateServerSummary(normalized.meta, normalized.services, state.processes);

    // Last alert + badge
    renderLastAlert(normalized.alerts, kpis);

    // Table
    renderTable();
  }

  async function refresh() {
    const json = await fetchData();
    if (!json) {
      // Mantém o que já estava; se não houver nada, mostra erro amigável na tabela
      if (!state.processes.length && els.procTbody) {
        els.procTbody.innerHTML = `<tr><td colspan="10" class="loading">Não foi possível carregar ${DATA_URL}. Verifique o servidor local e o caminho.</td></tr>`;
      }
      return;
    }

    const normalized = normalizeData(json);
    renderAll(normalized);
  }

  // ===== EVENTS =====
  function initEvents() {
    // top mode toggles
    els.btnTopCpu?.addEventListener("click", () => {
      state.modeTop = "cpu";
      els.btnTopCpu.classList.remove("outline");
      els.btnTopMem.classList.add("outline");
      if (state.raw) renderTopTable(computeKPIs(state.processes));
    });

    els.btnTopMem?.addEventListener("click", () => {
      state.modeTop = "mem";
      els.btnTopMem.classList.remove("outline");
      els.btnTopCpu.classList.add("outline");
      if (state.raw) renderTopTable(computeKPIs(state.processes));
    });

    // manual refresh
    els.btnRefresh?.addEventListener("click", () => refresh());

    // filters/search
    const onChange = debounce(() => renderTable(), 200);

    els.searchInput?.addEventListener("input", onChange);
    els.stateFilter?.addEventListener("change", () => renderTable());
    els.serviceFilter?.addEventListener("change", () => renderTable());
  }

  // ===== INIT =====
  function init() {
    initSortHeaders();
    initEvents();
    refresh();
    state.timer = setInterval(refresh, REFRESH_MS);
  }

  // DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();