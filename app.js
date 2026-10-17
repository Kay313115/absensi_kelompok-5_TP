// FINAL V12 FIXED - RAPI - FLIP KAMERA WORK HP
let currentDeviceMode = null;
let html5QrcodeScanner = null;
let todayKey = new Date().toISOString().slice(0, 10);
let isProcessing = false;
let statusKehadiranMode = 'HADIR';
let lastSendTime = 0;
let cameras = [];
let currentCameraIndex = 0;
let isScanning = false;

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxjx6qzwE6nd1ndHfAMalnzpOe5G2wEwnGpiSbiYK2B40eTJdEz1m9tW_GBIMyeqX0I2Q/exec";
const API_SECRET = "KLMPK5_2026_AMAN";

const listJamaah = [
  { nama: "alvin", kategori: "Bapak-Bapak", id: "BPK007" },
  { nama: "annisa", kategori: "Ibu-Ibu", id: "IBU006" },
  { nama: "algazali", kategori: "Remaja Putra", id: "RMJ005" },
  { nama: "risma", kategori: "Remaji Putri", id: "RMJ006" },
];

// ==============================
// RESET HARIAN
// ==============================

if (localStorage.getItem('lastScanDate') !== todayKey) {
  localStorage.removeItem('scannedToday');
  localStorage.setItem('lastScanDate', todayKey);
}

let scannedIdsToday = JSON.parse(
  localStorage.getItem('scannedToday') || '[]'
);

// ==============================
// FORMAT KATEGORI
// ==============================

function formatKategori(kategori) {
  if (!kategori) {
    return "-";
  }

  let k = kategori
    .toUpperCase()
    .trim()
    .substring(0, 30);

  if (k.includes('BAPAK')) {
    return 'Bapak-Bapak';
  }

  if (k.includes('IBU') && !k.includes('PUTRI')) {
    return 'Ibu-Ibu';
  }

  if (k.includes('REMAJA PUTRA')) {
    return 'Remaja Putra';
  }

  if (k.includes('REMAJI PUTRI') || k.includes('REMAJA PUTRI')) {
    return 'Remaji Putri';
  }

  if (k === 'PUTRA') {
    return 'Remaja Putra';
  }

  if (k === 'PUTRI') {
    return 'Remaji Putri';
  }

  return "-";
}

// ==============================
// DEVICE & SCANNER
// ==============================

function selectDevice(mode) {
  currentDeviceMode = mode;

  let label = mode === 'BAPAK' 
    ? 'Laki-laki' 
    : 'Perempuan';

  document.getElementById('selected-mode-text').innerText = `Absensi: ${label}`;
  document.getElementById('setup-section').classList.add('hidden');
  document.getElementById('scanner-section').classList.remove('hidden');

  setStatusKehadiran('HADIR');
  startScanner();
}

function resetDeviceSelection() {
  if (html5QrcodeScanner && isScanning) {
    html5QrcodeScanner.stop().then(() => {
      html5QrcodeScanner.clear();
      isScanning = false;

      document.getElementById('scanner-section').classList.add('hidden');
      document.getElementById('setup-section').classList.remove('hidden');
    }).catch(() => {
      document.getElementById('scanner-section').classList.add('hidden');
      document.getElementById('setup-section').classList.remove('hidden');
    });
  } else {
    document.getElementById('scanner-section').classList.add('hidden');
    document.getElementById('setup-section').classList.remove('hidden');
  }
}

async function getCamerasList() {
  try {
    cameras = await Html5Qrcode.getCameras();
    console.log("Kamera HP:", cameras);
  } catch (e) {
    console.log("Gagal dapet kamera:", e);
  }
}

async function startScanner() {
  if (cameras.length === 0) {
    await getCamerasList();
  }

  if (html5QrcodeScanner) {
    try {
      html5QrcodeScanner.clear();
    } catch (e) {}
  }

  html5QrcodeScanner = new Html5Qrcode("reader");

  const config = {
    fps: 10,
    qrbox: {
      width: 250,
      height: 250
    }
  };

  let cameraId;

  if (cameras.length > 0) {
    cameraId = cameras[currentCameraIndex].id;
  } else {
    cameraId = {
      facingMode: "environment"
    };
  }

  try {
    await html5QrcodeScanner.start(
      cameraId,
      config,
      onScanSuccess,
      () => {}
    );
    isScanning = true;
  } catch (err) {
    console.log("Coba kamera lain:", err);

    try {
      await html5QrcodeScanner.start(
        { facingMode: "user" },
        config,
        onScanSuccess,
        () => {}
      );
      isScanning = true;
    } catch (e) {
      console.log(e);
    }
  }
}

async function switchCamera() {
  if (cameras.length === 0) {
    await getCamerasList();
  }

  if (cameras.length <= 1) {
    alert("HP ini cuma ada 1 kamera Jan");
    return;
  }

  if (isScanning && html5QrcodeScanner) {
    await html5QrcodeScanner.stop();
    isScanning = false;
  }

  currentCameraIndex = (currentCameraIndex + 1) % cameras.length;

  await startScanner();

  showToast(
    "Ganti kamera: " + (currentCameraIndex === 0 ? "Belakang" : "Depan"),
    "sukses"
  );
}

function stopScanner() {
  resetDeviceSelection();
}

function setStatusKehadiran(mode) {
  statusKehadiranMode = mode;

  document.getElementById('btn-mode-hadir').style.opacity = mode == 'HADIR' ? '1' : '0.5';
  document.getElementById('btn-mode-izin').style.opacity = mode == 'IZIN' ? '1' : '0.5';

  document.getElementById('izin-section').classList.toggle('hidden', mode == 'HADIR');
  document.getElementById('reader').classList.toggle('hidden', mode != 'HADIR');
}

// ==============================
// IZIN MANUAL
// ==============================

function submitIzinManual() {
  document.getElementById('loading-overlay')?.classList.remove('hidden');

  setTimeout(() => {
    const nama = document
      .getElementById('input-nama-izin')
      .value.trim()
      .substring(0, 50);

    if (!nama || nama.length < 2) {
      alert('Nama minimal 2 huruf');
      return;
    }

    if (/[^a-zA-Z\s\.\-']/.test(nama)) {
      alert('Nama jangan pakai simbol aneh!');
      return;
    }

    const kategori = formatKategori(
      document.getElementById('input-kategori-izin').value
    );

    const id = nama.toUpperCase().replace(/\s/g, '') + "_" + Date.now();

    scannedIdsToday.push(id);
    localStorage.setItem('scannedToday', JSON.stringify(scannedIdsToday));

    showVisualResult(nama, kategori, `ALPA: Tanpa Keterangan`, true);
    playSound('sukses');
    addLogTable(nama, kategori, id, "Tanpa Keterangan");
    sendToGoogleSheet(nama, kategori, id, "Tanpa Keterangan");

    document.getElementById('input-nama-izin').value = '';
    document.getElementById('loading-overlay')?.classList.add('hidden');
  }, 400);
}

// ==============================
// SOUND
// ==============================

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'sukses') {
      osc.frequency.value = 900;
      gain.gain.value = 1;
      osc.start();

      setTimeout(() => {
        osc.frequency.value = 1200;
      }, 150);

      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 400);

      if ('speechSynthesis' in window) {
        setTimeout(() => {
          const msg = new SpeechSynthesisUtterance("Absen Berhasil");
          msg.lang = 'id-ID';
          speechSynthesis.speak(msg);
        }, 100);
      }

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } else if (type === 'duplikat') {
      osc.frequency.value = 500;
      osc.start();

      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 500);

      if (navigator.vibrate) {
        navigator.vibrate([300]);
      }
    } else {
      osc.frequency.value = 200;
      osc.start();

      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, 800);

      if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500]);
      }
    }
  } catch (e) {
    console.log(e);
  }
}

// ==============================
// SCAN QR
// ==============================

function onScanSuccess(decodedText) {
  if (isProcessing || statusKehadiranMode !== 'HADIR') {
    return;
  }

  isProcessing = true;

  if (decodedText.length > 200) {
    showVisualResult("Tolak", "TIDAK VALID", "QR terlalu panjang!", false);
    playSound('gagal');

    setTimeout(() => {
      isProcessing = false;
    }, 2000);

    return;
  }

  const parts = decodedText.split('|');

  if (parts.length !== 3) {
    showVisualResult("Format Salah", "TIDAK VALID", "Format QR salah.", false);
    playSound('gagal');

    setTimeout(() => {
      isProcessing = false;
    }, 2000);

    return;
  }

  const nama = parts[0]
    .trim()
    .substring(0, 50)
    .replace(/[^a-zA-Z\s\.\-']/g, '');

  const kategori = formatKategori(parts[1].trim());

  const idJamaah = parts[2]
    .trim()
    .substring(0, 100)
    .replace(/[^A-Z0-9\_\-]/g, '');

  if (kategori == "-") {
    showVisualResult(nama, "TIDAK VALID", "Kategori tidak dikenal!", false);
    playSound('gagal');

    setTimeout(() => {
      isProcessing = false;
    }, 3000);

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

    setTimeout(() => {
      isProcessing = false;
    }, 3000);

    return;
  }

  if (currentDeviceMode === 'IBU_REMAJA' && !(isIbu || isPutri)) {
    showVisualResult(nama, kategori, `GAGAL: ${kategori} harus ke HP Bapak!`, false);
    playSound('gagal');

    setTimeout(() => {
      isProcessing = false;
    }, 3000);

    return;
  }

  if (scannedIdsToday.includes(idJamaah)) {
    showVisualResult(nama, kategori, `DUPLIKAT: sudah absen!`, false);
    playSound('duplikat');
    addLogTable(nama, kategori, idJamaah, "Duplikat");

    setTimeout(() => {
      isProcessing = false;
    }, 3000);

    return;
  }

  scannedIdsToday.push(idJamaah);
  localStorage.setItem('scannedToday', JSON.stringify(scannedIdsToday));

  showVisualResult(nama, kategori, `SUKSES: ${nama} Hadir!`, true);
  playSound('sukses');
  addLogTable(nama, kategori, idJamaah, "Hadir");
  sendToGoogleSheet(nama, kategori, idJamaah, "Hadir");

  setTimeout(() => {
    isProcessing = false;
    document.getElementById('scan-result').classList.add('hidden');
  }, 3000);
}

// ==============================
// UI & LOG
// ==============================

function showVisualResult(nama, kategori, message, isSuccess) {
  const resultDiv = document.getElementById('scan-result');

  resultDiv.className = `result-box ${isSuccess ? 'sukses' : 'gagal'} ${kategori.replace(/[^a-zA-Z]/g, '_')}`;

  document.getElementById('result-nama').innerText = `Nama: ${nama}`;
  document.getElementById('result-status').innerText = `Kategori: ${kategori}`;
  document.getElementById('result-message').innerText = message;

  resultDiv.classList.remove('hidden');

  if (isSuccess) {
    showToast(message, 'sukses');
  } else if (message.toLowerCase().includes('duplikat')) {
    showToast(message, 'duplikat');
  } else {
    showToast(message, 'gagal');
  }

  updateLogCount();
}

function addLogTable(nama, kategori, id, ket) {
  const tbody = document.getElementById('attendance-log-body');
  const now = new Date();

  const timeString = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const row = document.createElement('tr');

  const td1 = document.createElement('td');
  td1.textContent = timeString;

  const td2 = document.createElement('td');
  td2.textContent = nama;
  td2.style.fontWeight = 'bold';

  const td3 = document.createElement('td');
  const badge = document.createElement('span');
  badge.className = "badge " + kategori.replace(/[^a-zA-Z]/g, '_');
  badge.textContent = kategori;
  td3.appendChild(badge);

  const td4 = document.createElement('td');
  td4.textContent = id;

  const td5 = document.createElement('td');
  td5.textContent = ket;
  td5.style.fontWeight = 'bold';
  td5.style.color = ket.toLowerCase().includes("hadir") ? "green" : "orange";

  row.append(td1, td2, td3, td4, td5);
  tbody.insertBefore(row, tbody.firstChild);
}

function sendToGoogleSheet(nama, kategori, id, keterangan) {
  const now = Date.now();

  if (now - lastSendTime < 2000) {
    return;
  }

  lastSendTime = now;

  const payload = {
    token: API_SECRET,
    nama: nama.toString().substring(0, 50),
    kategori: formatKategori(kategori),
    id: id.toString().substring(0, 100),
    keterangan: keterangan.toString().substring(0, 30)
  };

  try {
    const blob = new Blob(
      [JSON.stringify(payload)],
      { type: 'text/plain;charset=UTF-8' }
    );
    navigator.sendBeacon(GOOGLE_SCRIPT_URL, blob);
  } catch (e) {
    fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(payload)
    });
  }
}

function showToast(pesan, tipe = 'sukses') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${tipe}`;
  el.textContent = pesan;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3500);
}

function updateLogCount() {
  const count = document.querySelectorAll('#attendance-log-body tr').length;
  const empty = document.getElementById('empty-log');

  if (empty && count > 1) {
    empty.style.display = 'none';
  }

  const counter = document.getElementById('log-count');
  if (counter) {
    counter.textContent = `${count} jamaah`;
  }
}

getCamerasList();
