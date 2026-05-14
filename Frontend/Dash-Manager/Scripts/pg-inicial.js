async function atualizarDados() {

    try {

        const resposta =
            await fetch("http://127.0.0.1:8000/metricas", {
    cache: "no-store"
});

        if (!resposta.ok) {
            throw new Error("Erro HTTP: " + resposta.status);
        }

        const dados =
            await resposta.json();

        ////////////////// CPU //////////////////
        document.getElementById("cpuPercentual")
            .innerText =
            dados.cpu.toFixed(1) + "%";

        ////////////////// RAM //////////////////
        const ramTotal =
            dados.memory.total / 1024 / 1024;

        const ramUsada =
            dados.memory.used / 1024 / 1024;

        const ramLivre =
            dados.memory.available / 1024 / 1024;

        const ramPercentual =
            (ramUsada / ramTotal) * 100;

        document.getElementById("ramPercentual")
            .innerText =
            ramPercentual.toFixed(1);

        document.getElementById("ramLivre")
            .innerText =
            ramLivre.toFixed(1);

        document.getElementById("ramTotal")
            .innerText =
            ramTotal.toFixed(1);

        ////////////////// DISCO //////////////////
        document.getElementById("discoPercentual")
            .innerText =
            dados.disk.usage_percent;

        document.getElementById("discoLivre")
            .innerText =
            dados.disk.available;

        document.getElementById("discoTotal")
            .innerText =
            dados.disk.total;

        ////////////////// UPTIME //////////////////
        const uptimeSegundos =
            dados.uptime;

        const horas =
            Math.floor(uptimeSegundos / 3600);

        const minutos =
            Math.floor((uptimeSegundos % 3600) / 60);

        document.getElementById("uptime")
            .innerText =
            horas + "h " + minutos + "min";

        ////////////////// TEMPERATURA //////////////////
        document.getElementById("temperatura")
            .innerText =
            dados.temperature == -1
            ? "N/A"
            : dados.temperature.toFixed(1) + "°C";

        ////////////////// REDE //////////////////
        const downloadKBps =
            (dados.network.rx_rate / 1024).toFixed(2);

        const uploadKBps =
            (dados.network.tx_rate / 1024).toFixed(2);

        document.getElementById("download-Mbps")
            .innerText =
            downloadKBps;

        document.getElementById("upload-Mbps")
            .innerText =
            uploadKBps;

        //////////////HORA ATUAL//////////////////
        document.getElementById("horaAtual")
            .innerText =
            dados.current_time;

        ////////////////// PROCESSOS //////////////////
        document.getElementById("procesos-exec")
            .innerText =
            dados.processes;

        ////////////////// USUÁRIOS //////////////////
        document.getElementById("usuarios-conected")
            .innerText =
            "1";

        ////////////////// SISTEMA //////////////////
        document.getElementById("system")
            .innerText =
            "Linux";

        ////////////////// IP //////////////////
        document.getElementById("ip")
            .innerText =
            "127.0.0.1";

        ////////////////// BAR //////////////////
        document.getElementById("cpuBar")
            .style.width =
            dados.cpu + "%";

        const porcentagemRam =
            (dados.memory.used / dados.memory.total) * 100;

        document.getElementById("ramBar")
            .style.width =
            porcentagemRam + "%";

        const porcentagemDisco =
            parseFloat(dados.disk.usage_percent);

        document.getElementById("diskBar")
            .style.width =
            porcentagemDisco + "%";    

        document.getElementById("tempBar")
            .style.width =
            dados.temperature + "%";
        ////////////////// ALERTA //////////////////
        let alerta =
            "Sistema funcionando normalmente";

        if (dados.temperature > 80) {

            alerta =
                "Temperatura elevada detectada";
        }

        if (dados.cpu > 90) {

            alerta =
                "Uso de CPU acima de 90%";
        }

        if (dados.memory.used / dados.memory.total > 0.9) {

            alerta =
                "Uso de RAM acima de 90%";
        }

        document.getElementById("alert")
            .innerText =
            alerta;

    } catch (erro) {

        console.error(
            "Erro ao atualizar dados:",
            erro
        );
    }
}

setInterval(atualizarDados, 5000);

atualizarDados();