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

    usuarios_online[ip] = datetime.now()

    return {"status": "online"}


# USUÁRIOS ONLINE
@app.get("/usuarios-online")
def get_online():

    agora = datetime.now()

    ativos = [
        ip for ip, tempo in usuarios_online.items()
        if agora - tempo < timedelta(seconds=30)
    ]

    return {"usuarios_online": len(ativos)}