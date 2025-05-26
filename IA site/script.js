const video = document.getElementById("video");
const canvas = document.getElementById("streamCanvas");
const ctx = canvas.getContext("2d");
const textoIa = document.getElementById("texto-ia");
const videoCaptureCanvas = document.createElement("canvas");
const videoCaptureCtx = videoCaptureCanvas.getContext("2d");

const socket = new WebSocket("wss://web-socket-teste.onrender.com/ws");

const synth = window.speechSynthesis;
let logQueue = [];
let isSpeaking = false;
let recentLogs = {}; 

// Acesso à câmera com modo ideal (evita erro em desktop)
navigator.mediaDevices.getUserMedia({
  video: { facingMode: { ideal: "environment" } },
  audio: false
}).then(stream => {
  video.srcObject = stream;

  video.onloadedmetadata = () => {
    videoCaptureCanvas.width = video.videoWidth;
    videoCaptureCanvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  };

  // Captura e envia frames ao servidor
  setInterval(() => {
    videoCaptureCtx.drawImage(video, 0, 0, videoCaptureCanvas.width, videoCaptureCanvas.height);
    const frame = videoCaptureCanvas.toDataURL("image/jpeg");
    socket.send(JSON.stringify({ type: "frame", data: frame }));
  }, 300);

}).catch(err => {
  alert("Erro ao acessar câmera: " + err.message);
  console.error("Erro ao acessar câmera:", err);
});

// WebSocket: recebe dados do servidor
socket.onmessage = async (event) => {
  try {
    const msg = JSON.parse(event.data);

    if (msg.type === "text") {
      textoIa.textContent = msg.data;
      addLogToQueue(msg.data);

    } else if (msg.type === "image") {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = msg.data;

    } else {
      console.warn("Tipo de mensagem desconhecido:", msg);
    }

  } catch {
    // Se não for JSON, assume imagem base64
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = event.data;
  }
};

// Fila de fala: adiciona logs com verificação de repetição
function addLogToQueue(log) {
  const now = Date.now();
  const lastSpoken = recentLogs[log];

  if (lastSpoken && now - lastSpoken < 7000) {
    return; // Se falou há menos de 7s, ignora
  }

  logQueue.push(log);
  processLogQueue();
}

function processLogQueue() {
  if (isSpeaking || logQueue.length === 0) return;

  const log = logQueue.shift();
  textoIa.innerText = log;
  speakLog(log);
}

function speakLog(log) {
  if (!synth) return;

  const utterance = new SpeechSynthesisUtterance(log);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  isSpeaking = true;

  utterance.onend = () => {
    isSpeaking = false;

    // Registra que o log foi falado agora
    recentLogs[log] = Date.now();

    // Limpa logs antigos (>10s)
    cleanOldLogs();

    // Processa próxima
    setTimeout(processLogQueue, 200);
  };

  synth.speak(utterance);
}

function cleanOldLogs() {
  const now = Date.now();
  for (const log in recentLogs) {
    if (now - recentLogs[log] > 10000) {
      delete recentLogs[log];
    }
  }
}
