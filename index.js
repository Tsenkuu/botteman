// POLYFILL UNTUK MENGHINDARI CRASH CLOUDLINUX WASM (undici)
const nodeFetch = require('node-fetch');
global.fetch = nodeFetch;
global.Headers = nodeFetch.Headers;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;

require('dotenv').config();
const express  = require('express');
const { connectToWhatsApp, sendMessage, requestPairingCode, resetSession, botState } = require('./bot');
const { startScheduler } = require('./cron/scheduler');
const { notifyDonasiBaru, notifyDonaturKonfirmasi, notifyPesanUserBaru } = require('./handlers/notificationHandler');
const { logger, requestLogger } = require('./logger');

// Global Error Handlers
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION! Mematikan proses dengan aman...');
  logger.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Mematikan proses dengan aman...');
  logger.error(err);
  process.exit(1);
});

const app   = express();
const PORT  = process.env.PORT       || 3002;
const TOKEN = process.env.BOT_SECRET || 'RAHASIAPIXELYOGA';

app.use(express.json());

// Middleware Request Logger
app.use((req, res, next) => {
  requestLogger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// Izinkan CORS dari localhost agar PHP bisa panggil
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-bot-token, x-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const t = req.headers['x-bot-token']
         || req.headers['x-api-key']
         || req.body?.secret
         || req.body?.token
         || req.query.token
         || req.query.secret;
  if (t !== TOKEN) return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'wa-bot', status: 'running' });
});

// ─── Status Koneksi WA ────────────────────────────────────────────────────────
app.get('/status', auth, (req, res) => {
  res.json({
    success: true,
    data: {
      status:    botState.status,
      connected: botState.status === 'connected',
      number:    botState.connectedNum,
      message:   botState.status === 'connected'
                   ? `✅ Terhubung (${botState.connectedNum})`
                   : botState.status === 'connecting'
                   ? '⏳ Sedang menghubungkan...'
                   : '❌ Tidak terhubung',
    },
  });
});

// ─── Ambil QR Code sebagai Data URL ──────────────────────────────────────────
app.get('/qr', auth, (req, res) => {
  if (botState.status === 'connected') {
    return res.json({ success: false, message: 'Bot sudah terhubung. QR tidak diperlukan.' });
  }
  if (!botState.qrDataUrl) {
    return res.json({ success: false, message: 'QR belum tersedia. Tunggu beberapa detik atau restart bot.' });
  }
  res.json({
    success: true,
    data: {
      qr: botState.qrDataUrl,
      ts: botState.qrTimestamp,
    },
  });
});

// ─── Minta Pairing Code via Nomor HP ─────────────────────────────────────────
app.post('/pair', auth, async (req, res) => {
  const phone = req.body.phone || req.body.number;
  if (!phone) return res.status(400).json({ success: false, message: 'Parameter phone wajib diisi.' });

  try {
    const code = await requestPairingCode(phone);
    res.json({ success: true, data: { code } });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── Reset Sesi ───────────────────────────────────────────────────────────────
app.post('/reset', auth, async (req, res) => {
  try {
    await resetSession();
    res.json({ success: true, message: 'Sesi direset. Bot akan mencoba koneksi ulang.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Kirim Pesan Bebas ────────────────────────────────────────────────────────
app.post('/send', auth, async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ success: false, message: 'to dan message wajib diisi.' });
  try {
    await sendMessage(to, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Notifikasi: Donasi Baru ──────────────────────────────────────────────────
app.post('/notify/donasi-baru', auth, async (req, res) => {
  try {
    await notifyDonasiBaru({
      admin_wa:     process.env.ADMIN_WA || req.body.admin_wa,
      nama_donatur: req.body.nama_donatur,
      nominal:      req.body.nominal,
      program:      req.body.program,
      metode:       req.body.metode,
      invoice:      req.body.invoice,
      waktu:        req.body.waktu || new Date().toLocaleString('id-ID'),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Notifikasi: Konfirmasi Donasi ────────────────────────────────────────────
app.post('/notify/konfirmasi', auth, async (req, res) => {
  try {
    await notifyDonaturKonfirmasi({
      nomor_hp:     req.body.nomor_hp,
      nama_donatur: req.body.nama_donatur,
      nominal:      req.body.nominal,
      program:      req.body.program,
      invoice:      req.body.invoice,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Notifikasi: Pesan User Baru ─────────────────────────────────────────────
app.post('/notify/pesan-user', auth, async (req, res) => {
  try {
    await notifyPesanUserBaru({
      admin_wa:  process.env.ADMIN_WA || req.body.admin_wa,
      kode_user: req.body.kode_user,
      nama:      req.body.nama,
      pesan:     req.body.pesan,
      waktu:     req.body.waktu || new Date().toLocaleString('id-ID'),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Webhook dari PHP ─────────────────────────────────────────────────────────
app.post('/webhook', auth, (req, res) => {
  res.json({ success: true, message: 'Webhook received' });
});

// ─── Express Global Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`[EXPRESS ERROR] ${req.method} ${req.url}`);
  logger.error(err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// ─── Mulai Server & Bot ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`\n🤖 WhatsApp Bot Service berjalan di port ${PORT}`);
  logger.info('   Endpoint status : GET  /status');
  logger.info('   Endpoint QR     : GET  /qr');
  logger.info('   Endpoint pair   : POST /pair\n');
});

// Mulai koneksi WhatsApp dan cron di luar callback listen
// Ini sangat penting untuk hosting cPanel (Phusion Passenger) karena
// Passenger sering kali mengabaikan callback pada app.listen()
(async () => {
  try {
    await connectToWhatsApp();
    startScheduler();
  } catch (err) {
    logger.error('Gagal memulai bot:', err);
  }
})();
