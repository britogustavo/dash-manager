async function carregarDados() {
    try {
        const resposta = await fetch("../json/dados.json?ts=" + new Date().getTime());

        if (!resposta.ok) {
            throw new Error("Erro HTTP: " + resposta.status);
        }
        const dados = await resposta.json();

        document.getElementById("ramTotal").textContent = dados.memoria_ram.total_mb;
        document.getElementById("ramUsada").textContent = dados.memoria_ram.usada_mb;
        document.getElementById("ramLivre").textContent = dados.memoria_ram.livre_mb;


    }
}