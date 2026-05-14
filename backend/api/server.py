from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

usuarios_online = {}

TIMEOUT = timedelta(seconds=30)


@app.get("/")
def root():
    return {"message": "API funcionando"}


@app.get("/metricas")
def metricas():
    with open('../dados.json', 'r') as f:
        dados = json.load(f)

    return dados


# HEARTBEAT
@app.post("/ping")
async def ping(request: Request):
    ip = request.client.host
    agora = datetime.now()

    usuarios_online[ip] = agora

    return {
        "status": "online",
        "usuarios_online": len(usuarios_online)
    }


# USUÁRIOS ONLINE
@app.get("/usuarios-online")
def get_online():

    agora = datetime.now()

    # 🔥 remove inativos de verdade
    inativos = [
        ip for ip, tempo in usuarios_online.items()
        if agora - tempo > TIMEOUT
    ]

    for ip in inativos:
        usuarios_online.pop(ip, None)

    return {
        "usuarios_online": len(usuarios_online)
    }