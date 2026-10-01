const state = {
  mode: "single",
  singleText: "https://onthebeach.dev",
  batch: [],
  activeIndex: 0,
  style: { foreground: "#000000", gradientEnd: "#FF6B70", gradientAngle: 45, colorMode: "uniform", background: "#FFFFFF", transparent: false, shape: "square", logo: null },
  format: "png",
};

const $ = (selector) => document.querySelector(selector);
const preview = $("#qrPreview");
const toast = $("#toast");
let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function normaliseHex(value) {
  return value.toUpperCase();
}

function contrastIsLow() {
  const hexToLuminance = (hex) => {
    const parts = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
  };
  const background = hexToLuminance(state.style.background);
  const colors = state.style.colorMode === "gradient" ? [state.style.foreground, state.style.gradientEnd] : [state.style.foreground];
  return colors.some((color) => {
    const foreground = hexToLuminance(color);
    return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) < 3;
  });
}

function activeRecord() {
  if (state.mode === "batch") return state.batch[state.activeIndex] || null;
  const text = state.singleText.trim();
  return text ? { name: "qr_code", text } : null;
}

function safeFilename(name, fallback = "qr_code") {
  const cleaned = String(name || fallback)
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned || fallback;
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function buildQr(text) {
  const qr = qrcode(0, "H");
  qr.addData(text, "Byte");
  qr.make();
  return qr;
}

function isFinderZone(row, column, moduleCount) {
  const inTop = row < 7;
  const inLeft = column < 7;
  const inRight = column >= moduleCount - 7;
  const inBottom = row >= moduleCount - 7;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function finderSvg(row, column, cell, quiet, shape, id) {
  const x = (column + quiet) * cell;
  const y = (row + quiet) * cell;
  const size = cell * 7;
  const middleX = x + cell;
  const middleY = y + cell;
  const middleSize = cell * 5;
  const innerX = x + cell * 2;
  const innerY = y + cell * 2;
  const innerSize = cell * 3;
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  if (shape === "dots") {
    return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${size}" height="${size}"><circle cx="${centerX}" cy="${centerY}" r="${size / 2}" fill="white"/><circle cx="${centerX}" cy="${centerY}" r="${middleSize / 2}" fill="black"/></mask><circle cx="${centerX}" cy="${centerY}" r="${size / 2}" mask="url(#${id})"/><circle cx="${centerX}" cy="${centerY}" r="${innerSize / 2}"/>`;
  }
  const outerRadius = cell * 1.25;
  const middleRadius = cell * .8;
  const innerRadius = cell * .55;
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${size}" height="${size}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${outerRadius}" fill="white"/><rect x="${middleX}" y="${middleY}" width="${middleSize}" height="${middleSize}" rx="${middleRadius}" fill="black"/></mask><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${outerRadius}" mask="url(#${id})"/><rect x="${innerX}" y="${innerY}" width="${innerSize}" height="${innerSize}" rx="${innerRadius}"/>`;
}

function gradientDefinition(size) {
  if (state.style.colorMode !== "gradient") return "";
  const radians = (state.style.gradientAngle - 90) * Math.PI / 180;
  const radius = size / 2;
  const x1 = radius - Math.cos(radians) * radius;
  const y1 = radius - Math.sin(radians) * radius;
  const x2 = radius + Math.cos(radians) * radius;
  const y2 = radius + Math.sin(radians) * radius;
  return `<linearGradient id="qr-gradient" gradientUnits="userSpaceOnUse" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"><stop offset="0%" stop-color="${escapeXml(state.style.foreground)}"/><stop offset="100%" stop-color="${escapeXml(state.style.gradientEnd)}"/></linearGradient>`;
}

function logoSvg(size) {
  if (!state.style.logo) return "";
  const logoSize = 120;
  const padding = 13;
  const plateSize = logoSize + padding * 2;
  const plateX = (size - plateSize) / 2;
  const plateY = (size - plateSize) / 2;
  const logoX = (size - logoSize) / 2;
  const logoY = (size - logoSize) / 2;
  const plateColor = state.style.transparent ? "#FFFFFF" : escapeXml(state.style.background);
  return `<g aria-label="Logo central"><rect x="${plateX}" y="${plateY}" width="${plateSize}" height="${plateSize}" rx="18" fill="${plateColor}"/><image href="${escapeXml(state.style.logo)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/></g>`;
}

function qrSvg(text, size = 1024) {
  const qr = buildQr(text);
  const count = qr.getModuleCount();
  const quiet = 4;
  const all = count + quiet * 2;
  const cell = size / all;
  const background = state.style.transparent ? "" : `<rect width="${size}" height="${size}" fill="${state.style.background}"/>`;
  const cells = [];
  const finders = [];
  const shape = state.style.shape;
  const radius = shape === "rounded" ? Math.max(1, cell * .32) : shape === "dots" ? cell * .47 : 0;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const x = (col + quiet) * cell;
      const y = (row + quiet) * cell;
      const fixed = isFinderZone(row, col, count);
      if (fixed && shape !== "square") continue;
      if (shape === "dots") {
        cells.push(`<circle cx="${(x + cell / 2).toFixed(3)}" cy="${(y + cell / 2).toFixed(3)}" r="${radius.toFixed(3)}"/>`);
      } else {
        const rx = shape === "square" ? 0 : radius;
        cells.push(`<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${cell.toFixed(3)}" height="${cell.toFixed(3)}"${rx ? ` rx="${rx.toFixed(3)}"` : ""}/>`);
      }
    }
  }
  if (shape !== "square") {
    [[0, 0], [0, count - 7], [count - 7, 0]].forEach(([row, column], index) => finders.push(finderSvg(row, column, cell, quiet, shape, `finder-${index}`)));
  }
  const paint = state.style.colorMode === "gradient" ? "url(#qr-gradient)" : escapeXml(state.style.foreground);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR code"><defs>${gradientDefinition(size)}</defs>${background}<g fill="${paint}" shape-rendering="${shape === "square" ? "crispEdges" : "geometricPrecision"}">${cells.join("")}${finders.join("")}</g>${logoSvg(size)}</svg>`;
}

function render() {
  const record = activeRecord();
  const hasRecord = Boolean(record);
  preview.innerHTML = hasRecord ? qrSvg(record.text) : `<div class="empty-preview">Saisissez un texte<br/>pour commencer.</div>`;
  preview.style.background = state.style.transparent && hasRecord ? "repeating-conic-gradient(#e8ebf0 0% 25%, #fff 0% 50%) 50% / 18px 18px" : "transparent";
  $("#previewName").textContent = record ? record.name : "Aucun QR code";
  const count = state.mode === "batch" ? state.batch.length : 1;
  $("#previewCount").textContent = state.mode === "batch" ? `${count} QR code${count > 1 ? "s" : ""}` : "1 QR code";
  $("#batchBrowse").hidden = state.mode !== "batch" || state.batch.length < 2;
  $("#batchPosition").textContent = `${state.batch.length ? state.activeIndex + 1 : 0} / ${state.batch.length}`;
  $("#previousQr").disabled = state.activeIndex <= 0;
  $("#nextQr").disabled = state.activeIndex >= state.batch.length - 1;
  $("#gradientControls").hidden = state.style.colorMode !== "gradient";
  $("#removeLogo").hidden = !state.style.logo;
  $("#logoLabel").textContent = state.style.logo ? "Logo ajouté · 120 × 120 px" : "Ajouter un logo";
  $("#contrastWarning").hidden = state.style.transparent || !contrastIsLow();
  $("#downloadButton").disabled = !hasRecord;
  const plural = state.mode === "batch" && state.batch.length > 1;
  const ext = state.format.toUpperCase();
  $("#downloadLabel").textContent = plural ? `Télécharger le ZIP (${ext})` : `Télécharger le ${ext}`;
  $("#exportHelp").textContent = plural ? `Les ${state.batch.length} QR codes seront regroupés dans une archive ZIP.` : "Votre fichier sera téléchargé directement.";
  $("#topStatus").textContent = hasRecord ? "Aperçu en direct" : "En attente de contenu";
}

function selectMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const selected = button.dataset.mode === mode;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-checked", String(selected));
  });
  $("#singleSection").hidden = mode !== "single";
  $("#batchSection").hidden = mode !== "batch";
  render();
}

function delimiterFor(content) {
  const firstLine = content.split(/\r?\n/, 1)[0] || "";
  return firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
}

function parseCsv(content) {
  const delimiter = delimiterFor(content.replace(/^\uFEFF/, ""));
  const rows = [];
  let row = [];
  let field = "";
  let quote = false;
  const source = content.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quote && source[i + 1] === '"') { field += '"'; i += 1; } else quote = !quote;
    } else if (char === delimiter && !quote) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quote) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (quote) throw new Error("Une cellule CSV comporte un guillemet non fermé.");
  return rows;
}

function recordsFromCsv(content) {
  const rows = parseCsv(content);
  if (rows.length < 2) throw new Error("Le fichier doit contenir un en-tête et au moins une ligne.");
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const textIndex = headers.indexOf("text");
  const nameIndex = headers.indexOf("name");
  const usesNames = headers[0] === "name";
  if (usesNames && (headers.length !== 2 || nameIndex !== 0 || textIndex !== 1)) throw new Error("Avec « name », les colonnes attendues sont exactement : name,text.");
  if (!usesNames && (headers.length !== 1 || textIndex !== 0)) throw new Error("Le fichier doit avoir une colonne « text », ou les colonnes « name,text ».");
  const names = new Set();
  const records = rows.slice(1).map((row, index) => {
    if (row.length !== headers.length) throw new Error(`La ligne ${index + 2} ne respecte pas le nombre de colonnes.`);
    const text = row[textIndex].trim();
    if (!text) throw new Error(`La ligne ${index + 2} ne contient pas de texte.`);
    const name = usesNames ? row[nameIndex].trim() : `qr_code_${index + 1}`;
    if (!name) throw new Error(`La ligne ${index + 2} ne contient pas de nom.`);
    if (usesNames && names.has(name)) throw new Error(`Le nom « ${name} » est présent plusieurs fois.`);
    names.add(name);
    return { name, text };
  });
  if (!records.length) throw new Error("Le fichier ne contient aucune ligne exploitable.");
  return records;
}

async function handleCsv(file) {
  if (!file) return;
  const feedback = $("#csvFeedback");
  try {
    const records = recordsFromCsv(await file.text());
    state.batch = records;
    state.activeIndex = 0;
    feedback.className = "csv-feedback is-success";
    feedback.textContent = `${records.length} QR code${records.length > 1 ? "s" : ""} prêt${records.length > 1 ? "s" : ""} à exporter depuis « ${file.name} ».${records[0].name !== "qr_code_1" ? " Les noms de fichier ont été conservés." : " Les noms seront générés automatiquement."}`;
    render();
  } catch (error) {
    state.batch = [];
    state.activeIndex = 0;
    feedback.className = "csv-feedback is-error";
    feedback.textContent = error.message;
    render();
  }
}

function logoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 120;
      const context = canvas.getContext("2d");
      const scale = Math.min(120 / image.naturalWidth, 120 / image.naturalHeight);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (120 - width) / 2, (120 - height) / 2, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Ce fichier ne peut pas être utilisé comme logo.")); };
    image.src = url;
  });
}

async function handleLogo(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { showToast("Choisissez une image PNG, JPG, WebP ou SVG."); return; }
  if (file.size > 2 * 1024 * 1024) { showToast("Le logo doit peser moins de 2 Mo."); return; }
  try {
    state.style.logo = await logoDataUrl(file);
    $("#logoFile").value = "";
    render();
    showToast("Logo ajouté au centre du QR code.");
  } catch (error) { showToast(error.message || "Impossible d’ajouter ce logo."); }
}

function svgBlob(text) {
  return new Blob([qrSvg(text)], { type: "image/svg+xml;charset=utf-8" });
}

function pngBlob(text) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(svgBlob(text));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1024;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error("Impossible de créer le PNG.")); }, "image/png");
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Impossible de créer le PNG.")); };
    image.src = url;
  });
}

function download(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function downloadCodes() {
  const records = state.mode === "batch" ? state.batch : [activeRecord()].filter(Boolean);
  if (!records.length) return;
  const button = $("#downloadButton");
  button.disabled = true;
  const original = $("#downloadLabel").textContent;
  try {
    const extension = state.format;
    const create = extension === "svg" ? (text) => Promise.resolve(svgBlob(text)) : pngBlob;
    if (records.length === 1) {
      download(await create(records[0].text), `${safeFilename(records[0].name)}.${extension}`);
      showToast(`Le ${extension.toUpperCase()} est prêt.`);
    } else {
      if (typeof JSZip === "undefined") throw new Error("La création de l’archive est indisponible.");
      $("#downloadLabel").textContent = "Préparation de l’archive…";
      const zip = new JSZip();
      const occupied = new Set();
      for (let index = 0; index < records.length; index += 1) {
        let filename = safeFilename(records[index].name);
        let suffix = 2;
        while (occupied.has(filename.toLowerCase())) filename = `${safeFilename(records[index].name)}-${suffix++}`;
        occupied.add(filename.toLowerCase());
        zip.file(`${filename}.${extension}`, await create(records[index].text));
      }
      download(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), `qr_codes_${extension}.zip`);
      showToast(`Archive ZIP créée avec ${records.length} QR codes.`);
    }
  } catch (error) { showToast(error.message || "Une erreur est survenue lors de l’export."); }
  finally { button.disabled = false; $("#downloadLabel").textContent = original; }
}

document.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
$("#singleText").addEventListener("input", (event) => { state.singleText = event.target.value; render(); });
$("#csvFile").addEventListener("change", (event) => handleCsv(event.target.files[0]));
$("#logoFile").addEventListener("change", (event) => handleLogo(event.target.files[0]));
$("#removeLogo").addEventListener("click", () => { state.style.logo = null; render(); showToast("Logo retiré."); });
["dragenter", "dragover"].forEach((type) => $(".upload-zone").addEventListener(type, (event) => { event.preventDefault(); $(".upload-zone").classList.add("is-dragover"); }));
["dragleave", "drop"].forEach((type) => $(".upload-zone").addEventListener(type, (event) => { event.preventDefault(); $(".upload-zone").classList.remove("is-dragover"); }));
$(".upload-zone").addEventListener("drop", (event) => handleCsv(event.dataTransfer.files[0]));
$("#colorMode").addEventListener("change", (event) => { state.style.colorMode = event.target.value; render(); });
$("#foreground").addEventListener("input", (event) => { state.style.foreground = normaliseHex(event.target.value); $("#foregroundValue").value = state.style.foreground; render(); });
$("#gradientEnd").addEventListener("input", (event) => { state.style.gradientEnd = normaliseHex(event.target.value); $("#gradientEndValue").value = state.style.gradientEnd; render(); });
$("#gradientAngle").addEventListener("input", (event) => { state.style.gradientAngle = Number(event.target.value); $("#gradientAngleValue").value = `${state.style.gradientAngle}°`; render(); });
$("#background").addEventListener("input", (event) => { state.style.background = normaliseHex(event.target.value); $("#backgroundValue").value = state.style.background; render(); });
$("#transparent").addEventListener("change", (event) => { state.style.transparent = event.target.checked; render(); });
$("#shape").addEventListener("change", (event) => { state.style.shape = event.target.value; render(); });
$("#format").addEventListener("change", (event) => { state.format = event.target.value; render(); });
$("#previousQr").addEventListener("click", () => { state.activeIndex -= 1; render(); });
$("#nextQr").addEventListener("click", () => { state.activeIndex += 1; render(); });
$("#downloadButton").addEventListener("click", downloadCodes);
render();
