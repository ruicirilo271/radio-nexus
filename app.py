# -*- coding: utf-8 -*-
from flask import Flask, render_template, jsonify
from datetime import datetime
import pytz

app = Flask(__name__)

# 🎙️ Programação Rádio Nexus 24h
PROGRAMAS = [
    {"nome": "Madrugada Nexus", "inicio": 0, "fim": 6,
     "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/OBSERVADORAAC.aac?dist=onlineradiobox",
     "descricao": "As notícias e análises da madrugada, com a equipa Nexus."},

    {"nome": "Manhã Informativa", "inicio": 6, "fim": 10,
     "url": "https://directo.tsf.pt/tsfdirecto.mp3",
     "descricao": "Atualidade, trânsito e entrevistas em direto."},

    {"nome": "Foco Atual - CM Rádio", "inicio": 10, "fim": 13,
     "url": "https://emdireto.cmradio.pt/audio2/output-stream_1.m3u8",
     "descricao": "Informação e opinião com a equipa do Correio da Manhã Rádio."},

    {"nome": "Desporto Total", "inicio": 13, "fim": 15,
     "url": "https://directo.tsf.pt/tsfdirecto.mp3",
     "descricao": "Futebol, resumos e entrevistas desportivas."},

    {"nome": "Fórum de Opinião", "inicio": 15, "fim": 18,
     "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/OBSERVADORAAC.aac?dist=onlineradiobox",
     "descricao": "Debate político e económico com convidados e especialistas."},

    {"nome": "Jornal das 18", "inicio": 18, "fim": 20,
     "url": "https://directo.tsf.pt/tsfdirecto.mp3",
     "descricao": "Noticiário de fim de tarde e trânsito em direto."},

    {"nome": "Noite CM Rádio", "inicio": 20, "fim": 22,
     "url": "https://emdireto.cmradio.pt/audio2/output-stream_1.m3u8",
     "descricao": "Entrevistas e comentário político e social com a CM Rádio."},

    {"nome": "Linha Desportiva", "inicio": 22, "fim": 0,
     "url": "https://playerservices.streamtheworld.com/api/livestream-redirect/OBSERVADORAAC.aac?dist=onlineradiobox",
     "descricao": "Análises e debates desportivos para fechar o dia."},
]

DEFAULT_STREAM = {
    "nome": "Rádio Nexus",
    "url": "https://directo.tsf.pt/tsfdirecto.mp3",
    "descricao": "Emissão contínua de informação, entrevistas e desporto."
}


def programa_atual():
    """Determina o programa atual e o próximo, mesmo após a meia-noite."""
    agora = datetime.now(pytz.timezone("Europe/Lisbon"))
    hora = agora.hour

    atual = None
    for p in PROGRAMAS:
        ini, fim = p["inicio"], p["fim"]
        # Normaliza casos que atravessam a meia-noite (ex: 22→0)
        if ini < fim and ini <= hora < fim:
            atual = p
            break
        elif ini > fim and (hora >= ini or hora < fim):
            atual = p
            break

    if not atual:
        atual = DEFAULT_STREAM

    # Determina o próximo programa
    proximos = sorted(PROGRAMAS, key=lambda x: x["inicio"])
    proximo = None
    for p in proximos:
        if p["inicio"] > hora:
            proximo = p
            break
    if not proximo:
        proximo = proximos[0]  # volta ao primeiro do dia seguinte

    return {"atual": atual, "proximo": proximo}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/programa_atual")
def get_programa():
    return jsonify(programa_atual())


@app.route("/grelha")
def grelha():
    agora = datetime.now(pytz.timezone("Europe/Lisbon"))
    hora_atual = agora.hour
    return render_template("grelha.html", programas=PROGRAMAS, hora_atual=hora_atual)


if __name__ == "__main__":
    app.run(debug=True, port=8000)
