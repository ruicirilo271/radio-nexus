document.addEventListener("DOMContentLoaded", () => {
  const autoBtn = document.getElementById("autoBtn");
  const player = document.getElementById("player");
  const progNome = document.getElementById("progNome");
  const progDesc = document.getElementById("progDesc");
  const proximoTxt = document.getElementById("proximoTxt");
  const datetime = document.getElementById("datetime");
  const canvas = document.getElementById("equalizer");
  const ctx = canvas.getContext("2d");
  const logContent = document.getElementById("logContent");
  const toggleLogs = document.getElementById("toggleLogs");

  let autoMode = true;
  let intervalId = null;
  let audioCtx, analyser, source, dataArray, smoothArray;
  let hue = 0;
  let ultimoPrograma = null;
  let hlsInstance = null;

  /* ==================== DATA / HORA ==================== */
  function atualizarDataHora() {
    const agora = new Date();
    const dias = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
    const diaSemana = dias[agora.getDay()];
    const data = agora.toLocaleDateString("pt-PT",{day:"2-digit",month:"long",year:"numeric"});
    const hora = agora.toLocaleTimeString("pt-PT",{hour12:false});
    datetime.textContent = `${diaSemana}, ${data} — ${hora}`;
  }
  setInterval(atualizarDataHora,1000);
  atualizarDataHora();
    /* ==================== METEOROLOGIA LISBOA ==================== */
    /* ==================== METEOROLOGIA LISBOA ==================== */
  const weatherEl = document.getElementById("weather");

  async function atualizarTempo() {
    try {
      const resp = await fetch("https://api.open-meteo.com/v1/forecast?latitude=38.72&longitude=-9.14&current=temperature_2m,weather_code,is_day&timezone=Europe/Lisbon");
      const data = await resp.json();
      const temp = data.current?.temperature_2m;
      const codigo = data.current?.weather_code;
      const isDay = data.current?.is_day;

      if (temp === undefined || codigo === undefined) return;

      let icone = "☀️";

      // Mapeamento simplificado dos códigos meteorológicos Open-Meteo
      if ([0, 1].includes(codigo)) icone = isDay ? "☀️" : "🌙";               // céu limpo
      else if ([2, 3].includes(codigo)) icone = isDay ? "🌤️" : "☁️";        // nublado parcial
      else if ([45, 48].includes(codigo)) icone = "🌫️";                      // nevoeiro
      else if ([51, 53, 55, 56, 57].includes(codigo)) icone = "🌦️";         // chuviscos
      else if ([61, 63, 65, 66, 67].includes(codigo)) icone = "🌧️";         // chuva
      else if ([71, 73, 75, 77].includes(codigo)) icone = "❄️";              // neve
      else if ([80, 81, 82].includes(codigo)) icone = "🌦️";                 // aguaceiros
      else if ([95, 96, 99].includes(codigo)) icone = "⛈️";                  // trovoadas

      weatherEl.textContent = `${icone} Lisboa • ${temp.toFixed(1)} °C`;
    } catch (err) {
      console.warn("Falha ao obter temperatura:", err);
    }
  }

  atualizarTempo();
  setInterval(atualizarTempo, 15 * 60 * 1000); // a cada 15 minutos


  /* ==================== LOGS ==================== */
  function logMensagem(msg, tipo="info") {
    const agora = new Date().toLocaleTimeString("pt-PT",{hour12:false});
    const linha = document.createElement("div");
    linha.className = `log-line ${tipo}`;
    linha.textContent = `[${agora}] ${msg}`;
    logContent.prepend(linha);
    if (logContent.childElementCount > 10) logContent.lastChild.remove();
    console.log(msg);
  }

  /* ==================== EQUALIZER ==================== */
  function iniciarEqualizer() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source = audioCtx.createMediaElementSource(player);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      smoothArray = new Float32Array(bufferLength);

      function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        const w = (canvas.width = window.innerWidth * 0.9);
        const h = (canvas.height = 160);
        const barWidth = w / bufferLength;
        ctx.clearRect(0, 0, w, h);
        hue = (hue + 1) % 360;

        for (let i = 0; i < bufferLength; i++) {
          smoothArray[i] += (dataArray[i] - smoothArray[i]) * 0.25;
          const barHeight = smoothArray[i] * 1.2;
          const x = i * barWidth;
          const y = h - barHeight;
          const color = `hsl(${(hue + i * 4) % 360}, 100%, 50%)`;
          ctx.fillStyle = color;
          ctx.shadowBlur = 15;
          ctx.shadowColor = color;
          ctx.fillRect(x, y, barWidth - 1.5, barHeight);
        }
      }
      draw();
    }
  }

  /* ==================== PLAYER ==================== */
  async function tocarStream(nome, desc, url) {
    progNome.textContent = nome;
    progDesc.textContent = desc;
    iniciarEqualizer();

    logMensagem(`▶ ${nome}`, "atual");
    logMensagem(`📻 ${desc}`);
    logMensagem(`🌐 ${url}`);

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    try {
      if (audioCtx && audioCtx.state === "suspended") await audioCtx.resume();

      if (url.endsWith(".m3u8")) {
        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(url);
          hlsInstance.attachMedia(player);
          hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => player.play().catch(()=>{}));
        } else if (player.canPlayType("application/vnd.apple.mpegurl")) {
          player.src = url;
          await player.play();
        } else throw new Error("HLS não suportado.");
      } else {
        player.src = url;
        await player.play();
      }
    } catch (err) {
      console.error("Erro ao tocar stream:", err);
      logMensagem("⚠️ Erro ao carregar stream — tentativa de reconexão...", "warn");
      setTimeout(() => tocarStream(nome, desc, url), 5000);
    }
  }

  /* ==================== PROGRAMAS ==================== */
  async function atualizarPrograma() {
    if (!autoMode) return;
    try {
      const res = await fetch("/programa_atual");
      if (!res.ok) throw new Error("Falha ao obter programação.");
      const data = await res.json();
      const programaAtual = data.atual.nome;

      if (ultimoPrograma !== programaAtual) {
        ultimoPrograma = programaAtual;
        tocarStream(data.atual.nome, data.atual.descricao, data.atual.url);
        if (data.proximo)
          logMensagem(`⏭ A seguir: ${data.proximo.nome} às ${data.proximo.inicio}h`, "next");
      }

      if (data.proximo)
        proximoTxt.textContent = `🕒 A seguir: ${data.proximo.nome} às ${data.proximo.inicio}h`;
      else proximoTxt.textContent = "";
    } catch (err) {
      logMensagem("❌ Erro ao atualizar programação.", "warn");
      console.error(err);
    }
  }

  /* ==================== CONTROLO AUTOMÁTICO ==================== */
  autoBtn.onclick = () => {
    autoMode = true;
    autoBtn.classList.add("active");
    logMensagem("🔄 Modo Automático ativado manualmente.", "info");
    atualizarPrograma();
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(atualizarPrograma, 60_000);
  };

  /* ==================== PAINEL DE LOGS (OCULTAR / MOSTRAR) ==================== */
  if (toggleLogs) {
    toggleLogs.addEventListener("click", () => {
      const painel = document.getElementById("logPanel");
      const showBtn = document.getElementById("showLogsBtn");
      painel.classList.toggle("hidden");

      if (painel.classList.contains("hidden")) {
        toggleLogs.textContent = "📋 Mostrar Logs";
        showBtn.style.display = "block";
      } else {
        toggleLogs.textContent = "✖ Ocultar Logs";
        showBtn.style.display = "none";
      }
    });
  }

  // Botão flutuante “Mostrar Logs”
  const showLogsBtn = document.getElementById("showLogsBtn");
  if (showLogsBtn) {
    showLogsBtn.addEventListener("click", () => {
      const painel = document.getElementById("logPanel");
      painel.classList.remove("hidden");
      showLogsBtn.style.display = "none";
    });
  }

  /* ==================== INÍCIO ==================== */
  logMensagem("🚀 Rádio Nexus iniciada. A monitorizar programação...");
  atualizarPrograma();
});
