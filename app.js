const pieceSelect = document.getElementById("piece");
const pieceButton = document.getElementById("pieceButton");
const pieceValue = document.getElementById("pieceValue");
const pieceSheet = document.getElementById("pieceSheet");
const pieceOptions = document.getElementById("pieceOptions");
const serialInput = document.getElementById("serial");
const clearSerial = document.getElementById("clearSerial");
const openCameraButton = document.getElementById("openCamera");
const captureButton = document.getElementById("captureButton");
const closeCameraButton = document.getElementById("closeCamera");
const retakeButton = document.getElementById("retakeButton");
const downloadButton = document.getElementById("download");
const cameraCard = document.getElementById("cameraCard");
const cameraPreview = document.getElementById("cameraPreview");
const previewBox = document.getElementById("previewBox");
const preview = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const status = document.getElementById("status");
const statusText = document.getElementById("statusText");
const bottomAction = document.getElementById("bottomAction");
const cameraFallback = document.getElementById("cameraFallback");

let stream = null;
let finalBlob = null;
let previewUrl = null;

const pieces = [...pieceSelect.options].map(option => ({ value: option.value, label: option.textContent }));
renderPieceOptions();
updateSerialClear();

pieceButton.addEventListener("click", () => openPieceSheet());
serialInput.addEventListener("input", updateSerialClear);
clearSerial.addEventListener("click", () => { serialInput.value = ""; updateSerialClear(); serialInput.focus(); });
openCameraButton.addEventListener("click", openCamera);
captureButton.addEventListener("click", capturePhoto);
closeCameraButton.addEventListener("click", closeCamera);
retakeButton.addEventListener("click", openCamera);
downloadButton.addEventListener("click", downloadPhoto);
pieceSheet.addEventListener("click", event => { if (event.target === pieceSheet) closePieceSheet(); });

cameraFallback.addEventListener("change", async () => {
  const file = cameraFallback.files?.[0];
  if (!file) return;
  await processPhoto(file);
  cameraFallback.value = "";
});

function renderPieceOptions() {
  pieceOptions.innerHTML = pieces.map(piece => `
    <button class="sheet-option" type="button" data-value="${escapeHtml(piece.value)}" aria-selected="${piece.value === pieceSelect.value}">
      <span>${escapeHtml(piece.label)}</span>
      <span class="sheet-check">${piece.value === pieceSelect.value ? "✓" : ""}</span>
    </button>
  `).join("");

  pieceOptions.querySelectorAll(".sheet-option").forEach(button => {
    button.addEventListener("click", () => {
      pieceSelect.value = button.dataset.value;
      pieceValue.textContent = pieces.find(p => p.value === pieceSelect.value)?.label || pieceSelect.value;
      renderPieceOptions();
      closePieceSheet();
    });
  });
}

function openPieceSheet() {
  renderPieceOptions();
  pieceSheet.classList.remove("hidden");
  pieceSheet.setAttribute("aria-hidden", "false");
  pieceButton.setAttribute("aria-expanded", "true");
}

function closePieceSheet() {
  pieceSheet.classList.add("hidden");
  pieceSheet.setAttribute("aria-hidden", "true");
  pieceButton.setAttribute("aria-expanded", "false");
}

function updateSerialClear() {
  clearSerial.classList.toggle("hidden", serialInput.value.length === 0);
}

function setStatus(message, type = "info", visible = true) {
  statusText.textContent = message;
  status.className = `status status--${type}${visible ? "" : " hidden"}`;
}

async function openCamera() {
  if (!serialInput.value.trim()) {
    serialInput.focus();
    setStatus("Escribe el número de serie antes de tomar la foto.", "error");
    return;
  }

  setStatus("Abriendo cámara...", "info");

  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Tu navegador usará la cámara del teléfono.", "info");
    cameraFallback.click();
    return;
  }

  try {
    closeCamera();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    });
    cameraPreview.srcObject = stream;
    cameraCard.classList.remove("hidden");
    previewBox.classList.add("hidden");
    bottomAction.classList.add("hidden");
    await cameraPreview.play();
    setStatus("", "info", false);
  } catch (error) {
    console.error(error);
    setStatus("No se pudo abrir la cámara directamente; se abrirá la cámara del teléfono.", "error");
    cameraFallback.click();
  }
}

function capturePhoto() {
  if (!cameraPreview.videoWidth || !cameraPreview.videoHeight) {
    setStatus("Espera un momento a que cargue la cámara.", "error");
    return;
  }

  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);
  if (navigator.vibrate) navigator.vibrate(10);

  closeCamera();
  addWatermarkToCanvas(ctx, canvas.width, canvas.height);
  setStatus("Procesando foto...", "info");

  canvas.toBlob(blob => {
    if (!blob) {
      setStatus("No se pudo generar la foto.", "error");
      return;
    }
    finalBlob = blob;
    showPreview(blob);
    setStatus("Foto lista para guardar.", "success");
  }, "image/jpeg", 0.92);
}

async function processPhoto(file) {
  setStatus("Procesando foto...", "info");
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    const maxWidth = 1800;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    addWatermarkToCanvas(ctx, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      URL.revokeObjectURL(objectUrl);
      if (!blob) return setStatus("No se pudo generar la foto.", "error");
      finalBlob = blob;
      showPreview(blob);
      setStatus("Foto lista para guardar.", "success");
    }, "image/jpeg", 0.92);
  };
  image.onerror = () => { URL.revokeObjectURL(objectUrl); setStatus("No se pudo leer la foto.", "error"); };
  image.src = objectUrl;
}

function addWatermarkToCanvas(ctx, width, height) {
  const piece = pieceSelect.value;
  const serial = serialInput.value.trim();
  const padding = Math.max(12, Math.round(width * 0.014));
  const fontSize = Math.max(18, Math.round(width * 0.021));
  const smallSize = Math.max(13, Math.round(fontSize * 0.68));
  const lineHeight = fontSize * 1.15;
  const boxHeight = lineHeight + smallSize * 1.15 + padding * 1.7;
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  const pieceWidth = ctx.measureText(piece).width;
  const detail = `Serie: ${serial} · ${formatDate(new Date())}`;
  ctx.font = `600 ${smallSize}px system-ui, sans-serif`;
  const detailWidth = ctx.measureText(detail).width;
  const boxWidth = Math.min(width - padding * 2, Math.max(pieceWidth, detailWidth) + padding * 2);
  const x = padding;
  const y = height - boxHeight - padding;
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  roundRect(ctx, x, y, boxWidth, boxHeight, Math.round(fontSize * 0.45));
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "top";
  ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
  ctx.fillText(piece, x + padding, y + padding * 0.55);
  ctx.font = `600 ${smallSize}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.fillText(detail, x + padding, y + padding * 0.55 + lineHeight);
}

function formatDate(date) { return date.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius); ctx.closePath();
}

function showPreview(blob) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blob);
  preview.src = previewUrl;
  previewBox.classList.remove("hidden");
  bottomAction.classList.remove("hidden");
}

function closeCamera() {
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; }
  cameraPreview.srcObject = null;
  cameraCard.classList.add("hidden");
  bottomAction.classList.remove("hidden");
}

function downloadPhoto() {
  if (!finalBlob) return;
  const piece = sanitizeFileName(pieceSelect.value);
  const serial = sanitizeFileName(serialInput.value.trim());
  const date = formatDate(new Date()).replaceAll("/", "-");
  const filename = `${piece}_${serial}_${date}.jpg`;
  const url = URL.createObjectURL(finalBlob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (navigator.vibrate) navigator.vibrate(10);
  setStatus("Foto guardada correctamente.", "success");
}

function sanitizeFileName(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase();
}
function escapeHtml(value) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
window.addEventListener("beforeunload", closeCamera);
