// FINAL V14 - FIX SUARA DUPLIKAT PASTI BUNYI
let currentDeviceMode = null;
let html5QrcodeScanner = null;
let todayKey = new Date().toISOString().slice(0, 10);
let isProcessing = false;
let statusKehadiranMode = 'HADIR';
let lastSendTime = 0;
let isScanning = false;
let currentFacing = "environment";

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjx6qzwE6nd1ndHfAMalnzpOe5G2wEwnGpiSbiYK2B40eTJdEz1m9tW_GBIMyeqX0I2Q/exec";
const API_SECRET = "KLMPK5_2026_AMAN";

if (localStorage.getItem('lastScanDate') !== todayKey) {
  localStorage.removeItem('scannedToday');
  localStorage.setItem('lastScanDate', todayKey);
}
let scannedIdsToday = JSON.parse(localStorage.getItem('scannedToday') || '[]');

function formatKategori(kategori) {
  if (!kategori) return "-";
  let k = kategori.toUpperCase().trim().substring(0, 30);
  if (k.includes('BAPAK')) return 'Bapak-Bapak';
  if (k.includes('IBU') && !k.includes('PUTRI')) return 'Ibu-Ibu';
  if (k.includes('REMAJA PUTRA')) return 'Remaja Putra';
  if (k.includes('REMAJI PUTRI') || k.includes('REMAJA PUTRI')) return 'Remaja Putri';
  if (k === 'PUTRA') return 'Remaja Putra';
  if (k === 'PUTRI') return 'Remaja Putri';
  return "-";
}

function selectDevice(mode) {
  currentDeviceMode = mode;
  let label = mode === 'BAPAK' ? 'Laki-laki' : 'Perempuan';
  document.getElementById('selected-mode-text').innerText = `Absensi: ${label}`;
  document.getElementById('setup-section').classList.add('hidden');
  document.getElementById('scanner-section').classList.remove('hidden');
  setStatusKehadiran('HADIR');
  currentFacing = "environment";
  unlockAudio(); // AUTO UNLOCK PAS PILIH DEVICE
  startScanner();
}

function resetDeviceSelection() {
  try {
    if (html5QrcodeScanner) {
      html5QrcodeScanner.stop().catch(() => {});
      html5QrcodeScanner.clear();
    }
  } catch (e) {}
  html5QrcodeScanner = null;
  isScanning = false;
  const reader = document.getElementById('reader');
  if (reader) reader.innerHTML = "";
  document.getElementById('scanner-section').classList.add('hidden');
  document.getElementById('setup-section').classList.remove('hidden');
}

async function startScanner() {
  const readerEl = document.getElementById('reader');
  if (readerEl) readerEl.innerHTML = "";
  html5QrcodeScanner = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  try {
    await html5QrcodeScanner.start({ facingMode: currentFacing }, config, onScanSuccess, () => {});
    isScanning = true;
  } catch (err) {
    showToast("Gagal buka kamera", "gagal");
  }
}

async function switchCamera() {
  currentFacing = currentFacing === "environment" ? "user" : "environment";
  try {
    if (html5QrcodeScanner) {
      await html5QrcodeScanner.stop().catch(()=>{});
      html5QrcodeScanner.clear();
    }
  } catch (e) {}
  isScanning = false;
  setTimeout(async () => {
    await startScanner();
    showToast(currentFacing === "environment" ? "Kamera Belakang" : "Kamera Depan", "sukses");
  }, 300);
}

function stopScanner() { resetDeviceSelection(); }

function setStatusKehadiran(mode) {
  statusKehadiranMode = mode;
  document.getElementById('btn-mode-hadir').style.opacity = mode == 'HADIR' ? '1' : '0.5';
  document.getElementById('btn-mode-izin').style.opacity = mode == 'IZIN' ? '1' : '0.5';
  document.getElementById('izin-section').classList.toggle('hidden', mode == 'HADIR');
  document.getElementById('reader').classList.toggle('hidden', mode != 'HADIR');
}

function submitIzinManual() {
  document.getElementById('loading-overlay')?.classList.remove('hidden');
  setTimeout(() => {
    const nama = document.getElementById('input-nama-izin').value.trim().substring(0, 50);
    if (!nama || nama.length < 2) {
      alert('Nama minimal 2 huruf');
      document.getElementById('loading-overlay')?.classList.add('hidden');
      return;
    }
    const kategori = formatKategori(document.getElementById('input-kategori-izin').value);
    const id = nama.toUpperCase().replace(/\s/g, '') + "_" + Date.now();
    scannedIdsToday.push(id);
    localStorage.setItem('scannedToday', JSON.stringify(scannedIdsToday));
    showVisualResult(nama, kategori, `ALPA: Tanpa Keterangan`, true);
    playSound('sukses');
    speak("Absen Berhasil");
    addLogTable(nama, kategori, id, "Tanpa Keterangan");
    sendToGoogleSheet(nama, kategori, id, "Tanpa Keterangan");
    document.getElementById('input-nama-izin').value = '';
    document.getElementById('loading-overlay')?.classList.add('hidden');
  }, 400);
}

// === FIX UTAMA SUARA ===
function unlockAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    window.speechSynthesis.getVoices();
  } catch(e){}
}

function speak(text) {
  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'id-ID';
    msg.rate = 0.9;
    msg.volume = 1;
    msg.pitch = 1;
    window.speechSynthesis.speak(msg);
  } catch (e) {}
}

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    if (type === 'sukses') {
      osc.frequency.value = 900; gain.gain.value = 1; osc.start();
      setTimeout(() => { osc.frequency.value = 1200; }, 150);
      setTimeout(() => { osc.stop(); ctx.close(); }, 400);
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } else if (type === 'duplikat') {
      osc.frequency.value = 400; osc.start();
      setTimeout(() => { osc.frequency.value = 250; }, 200);
      setTimeout(() => { osc.stop(); ctx.close(); }, 600);
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    } else {
      osc.frequency.value = 200; osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 800);
    }
  } catch (e) {}
}

function onScanSuccess(decodedText) {
  if (isProcessing || statusKehadiranMode !== 'HADIR') return;
  isProcessing = true;
  const parts = decodedText.split('|');
  if (parts.length !== 3) {
    showVisualResult("Format Salah", "TIDAK VALID", "Format QR salah.", false);
    playSound('gagal');
    speak("QR tidak valid");
    setTimeout(() => { isProcessing = false; }, 2000);
    return;
  }
  const nama = parts[0].trim().substring(0, 50).replace(/[^a-zA-Z\s\.\-']/g, '');
  const kategori = formatKategori(parts[1].trim());
  const idJamaah = parts[2].trim().substring(0, 100).replace(/[^A-Z0-9\_\-]/g, '');
  if (kategori == "-") {
    showVisualResult(nama, "TIDAK VALID", "Kategori tidak dikenal!", false);
    playSound('gagal');
    speak("Kategori tidak valid");
    setTimeout(() => { isProcessing = false; }, 3000);
    return;
  }
  let kUpper = parts[1].toUpperCase();
  let isBapak = kUpper.includes('BAPAK');
  let isIbu = kUpper.includes('IBU') && !kUpper.includes('PUTRI');
  let isPutra = kUpper.includes('PUTRA');
  let isPutri = kUpper.includes('PUTRI');
  if (currentDeviceMode === 'BAPAK' && !(isBapak || isPutra)) {
    showVisualResult(nama, kategori, `GAGAL: ${kategori} harus ke HP Ibu!`, false);
    playSound('gagal');
    speak("Salah tempat absen");
    setTimeout(() => { isProcessing = false; }, 3000);
    return;
  }
  if (currentDeviceMode === 'IBU_REMAJA' && !(isIbu || isPutri)) {
    showVisualResult(nama, kategori, `GAGAL: ${kategori} harus ke HP Bapak!`, false);
    playSound('gagal');
    speak("Salah tempat absen");
    setTimeout(() => { isProcessing = false; }, 3000);
    return;
  }
  if (scannedIdsToday.includes(idJamaah)) {
    showVisualResult(nama, kategori, `DUPLIKAT: sudah absen!`, false);
    playSound('duplikat');
    speak("Anda sudah absen hari ini");
    addLogTable(nama, kategori, idJamaah, "Duplikat");
    setTimeout(() => { isProcessing = false; }, 3500);
    return;
  }
  scannedIdsToday.push(idJamaah);
  localStorage.setItem('scannedToday', JSON.stringify(scannedIdsToday));
  showVisualResult(nama, kategori, `SUKSES: ${nama} Hadir!`, true);
  playSound('sukses');
  speak("Absen Berhasil");
  addLogTable(nama, kategori, idJamaah, "Hadir");
  sendToGoogleSheet(nama, kategori, idJamaah, "Hadir");
  setTimeout(() => {
    isProcessing = false;
    document.getElementById('scan-result').classList.add('hidden');
  }, 3000);
}

function showVisualResult(nama, kategori, message, isSuccess) {
  const resultDiv = document.getElementById('scan-result');
  resultDiv.className = `result-box ${isSuccess ? 'sukses' : 'gagal'} ${kategori.replace(/[^a-zA-Z]/g, '_')}`;
  document.getElementById('result-nama').innerText = `Nama: ${nama}`;
  document.getElementById('result-status').innerText = `Kategori: ${kategori}`;
  document.getElementById('result-message').innerText = message;
  resultDiv.classList.remove('hidden');
  if (isSuccess) showToast(message, 'sukses');
  else if (message.toLowerCase().includes('duplikat')) showToast(message, 'duplikat');
  else showToast(message, 'gagal');
  updateLogCount();
}

function addLogTable(nama, kategori, id, ket) {
  const tbody = document.getElementById('attendance-log-body');
  const now = new Date();
  const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const row = document.createElement('tr');
  const td1 = document.createElement('td'); td1.textContent = timeString;
  const td2 = document.createElement('td'); td2.textContent = nama; td2.style.fontWeight = 'bold';
  const td3 = document.createElement('td'); const badge = document.createElement('span'); badge.className = "badge " + kategori.replace(/[^a-zA-Z]/g, '_'); badge.textContent = kategori; td3.appendChild(badge);
  const td4 = document.createElement('td'); td4.textContent = id;
  const td5 = document.createElement('td'); td5.textContent = ket; td5.style.fontWeight = 'bold'; td5.style.color = ket.toLowerCase().includes("hadir") ? "green" : "orange";
  row.append(td1, td2, td3, td4, td5); tbody.insertBefore(row, tbody.firstChild);
}

function sendToGoogleSheet(nama, kategori, id, keterangan) {
  const now = Date.now();
  if (now - lastSendTime < 2000) return;
  lastSendTime = now;
  const payload = { token: API_SECRET, nama: nama.toString().substring(0, 50), kategori: formatKategori(kategori), id: id.toString().substring(0, 100), keterangan: keterangan.toString().substring(0, 30) };
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' });
    navigator.sendBeacon(GOOGLE_SCRIPT_URL, blob);
  } catch (e) {
    fetch(GOOGLE_SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
  }
}

function showToast(pesan, tipe = 'sukses') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div'); el.className = `toast ${tipe}`; el.textContent = pesan;
  container.appendChild(el); setTimeout(() => el.remove(), 3500);
}

function updateLogCount() {
  const count = document.querySelectorAll('#attendance-log-body tr').length;
  const empty = document.getElementById('empty-log');
  if (empty && count > 1) empty.style.display = 'none';
  const counter = document.getElementById('log-count');
  if (counter) counter.textContent = `${count} jamaah`;
}

window.speechSynthesis.getVoices();
window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
