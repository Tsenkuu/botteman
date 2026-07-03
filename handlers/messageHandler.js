const axios = require('axios');
const { logger } = require('../logger');

const PHP_BASE_URL = process.env.PHP_BASE_URL || 'http://localhost/temanamal';
const BOT_SECRET   = process.env.BOT_SECRET   || 'RAHASIAPIXELYOGA';
const ADMIN_WA     = process.env.ADMIN_WA      || '6285806917113';

/**
 * Tangani pesan masuk dari WhatsApp.
 * @param {object} sock  - Baileys socket
 * @param {object} msg   - Pesan masuk
 */
async function handleMessage(sock, msg) {
  const remoteJid = msg.key.remoteJid;
  const senderNum = remoteJid.replace('@s.whatsapp.net', '');

  // Ambil teks pesan (support text biasa dan extended text)
  const pesan =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    '';

  if (!pesan.trim()) return; // Abaikan pesan tanpa teks (foto, stiker, dll)

  const pesanLower = pesan.toLowerCase().trim();
  logger.info(`[MSG] Dari ${senderNum}: ${pesan}`);

  try {
    // ── ADMIN COMMANDS ─────────────────────────────────────────────────────
    if (senderNum === ADMIN_WA || senderNum === ADMIN_WA.replace(/^62/, '0')) {
      // Balas pesan user: !jawab|kode_user teks balasan
      const jawabMatch = pesan.match(/^!jawab[\s|]+(\S+)\s+(.+)$/is);
      if (jawabMatch) {
        await handleJawab(sock, remoteJid, senderNum, jawabMatch[1], jawabMatch[2]);
        return;
      }

      // Format salah
      if (pesanLower.startsWith('!jawab')) {
        await reply(sock, remoteJid, '⚠️ *Format Salah*\n\nGunakan:\n`!jawab|kode_user pesan`\n\nContoh:\n`!jawab|user_abc123 Halo kak, terima kasih`');
        return;
      }

      // Perintah laporan manual
      if (pesanLower === '!laporan' || pesanLower === '!report') {
        await handleLaporanAdmin(sock, remoteJid);
        return;
      }

      // Info admin
      if (pesanLower === '!help' || pesanLower === '!bantuan') {
        await reply(sock, remoteJid, adminHelpText());
        return;
      }
    }

    // ── USER COMMANDS ──────────────────────────────────────────────────────

    // Cek status donasi berdasarkan nomor invoice
    const invoiceMatch = pesan.match(/^(?:cek|status|donasi|invoice)[\s#:]+([A-Z0-9]{6,20})$/i);
    if (invoiceMatch) {
      await handleCekDonasi(sock, remoteJid, invoiceMatch[1].toUpperCase());
      return;
    }

    // Info daftar program
    if (pesanLower === '#program' || pesanLower === 'program' || pesanLower === 'list program') {
      await handleDaftarProgram(sock, remoteJid);
      return;
    }

    // Pesan sapaan / selamat datang
    if (['halo', 'hai', 'hello', 'hi', 'assalamualaikum', 'assalamualaikum warahmatullahi wabarakatuh'].some(s => pesanLower.includes(s))) {
      await handleSambutan(sock, remoteJid, senderNum);
      return;
    }

    // Perintah bantuan
    if (pesanLower === 'bantuan' || pesanLower === 'help' || pesanLower === 'menu') {
      await handleMenu(sock, remoteJid);
      return;
    }

    // Kirim menu default jika tidak ada yang cocok
    await handleDefaultReply(sock, remoteJid);

  } catch (err) {
    logger.error(`[handleMessage ERROR] ${err.message}`);
    logger.error(err);
    await reply(sock, remoteJid, '❌ Maaf, terjadi kesalahan sistem. Silakan coba lagi nanti.');
  }
}

// ─── Handler: Balas Pesan User ────────────────────────────────────────────────
async function handleJawab(sock, adminJid, adminNum, kodeUser, balasan) {
  try {
    const res = await axios.post(`${PHP_BASE_URL}/wa_webhook.php`, {
      message: `!jawab|${kodeUser} ${balasan}`,
      sender: adminNum,
      secret: BOT_SECRET,
    });
    if (res.data?.status === 'processed') {
      await reply(sock, adminJid, `✅ Balasan terkirim ke *${kodeUser}*.`);
    }
  } catch (err) {
    await reply(sock, adminJid, `❌ Gagal kirim balasan: ${err.message}`);
  }
}

// ─── Handler: Cek Status Donasi ───────────────────────────────────────────────
async function handleCekDonasi(sock, remoteJid, invoice) {
  try {
    const res = await axios.get(`${PHP_BASE_URL}/api/cek_donasi.php`, {
      params: { invoice, secret: BOT_SECRET },
    });
    const d = res.data;
    if (!d.success) {
      await reply(sock, remoteJid, `❌ Invoice *${invoice}* tidak ditemukan.\n\nPastikan nomor invoice sudah benar.`);
      return;
    }
    await reply(sock, remoteJid,
      `📋 *STATUS DONASI*\n\n` +
      `Invoice : ${invoice}\n` +
      `Donatur : ${d.nama_donatur}\n` +
      `Nominal : Rp ${formatRupiah(d.nominal)}\n` +
      `Program : ${d.program}\n` +
      `Status  : ${d.status === 'terkonfirmasi' ? '✅ Dikonfirmasi' : '⏳ Menunggu Konfirmasi'}\n` +
      `Tanggal : ${d.tanggal}`
    );
  } catch (err) {
    await reply(sock, remoteJid, `❌ Gagal mengecek donasi: ${err.message}`);
  }
}

// ─── Handler: Daftar Program ──────────────────────────────────────────────────
async function handleDaftarProgram(sock, remoteJid) {
  try {
    const res = await axios.get(`${PHP_BASE_URL}/api/list_program.php`, {
      params: { secret: BOT_SECRET },
    });
    const programs = res.data?.programs || [];
    if (!programs.length) {
      await reply(sock, remoteJid, '📭 Belum ada program aktif saat ini.');
      return;
    }
    const lines = programs.map((p, i) =>
      `${i + 1}. *${p.nama}*\n   Target: Rp ${formatRupiah(p.target)}\n   Terkumpul: Rp ${formatRupiah(p.terkumpul)}`
    ).join('\n\n');
    await reply(sock, remoteJid, `🏷️ *PROGRAM DONASI AKTIF*\n\n${lines}\n\n_Kunjungi temanamal.org untuk berdonasi._`);
  } catch (err) {
    await reply(sock, remoteJid, '❌ Gagal mengambil daftar program.');
  }
}

// ─── Handler: Laporan Harian (Admin) ─────────────────────────────────────────
async function handleLaporanAdmin(sock, remoteJid) {
  try {
    const res = await axios.get(`${PHP_BASE_URL}/api/laporan_harian.php`, {
      params: { secret: BOT_SECRET },
    });
    const d = res.data;
    if (!d.success) {
      await reply(sock, remoteJid, '❌ Gagal mengambil laporan.');
      return;
    }
    const topText = d.top_program?.length
      ? d.top_program.map((p, i) => `  ${i + 1}. ${p.nama} — Rp ${formatRupiah(p.total)}`).join('\n')
      : '  Belum ada donasi hari ini';

    await reply(sock, remoteJid,
      `📊 *LAPORAN HARIAN LAZISMU*\n📅 ${d.tanggal}\n\n` +
      `💰 Total Nominal : Rp ${formatRupiah(d.total_nominal)}\n` +
      `📦 Jumlah Donasi : ${d.total_donasi} transaksi\n` +
      `👥 Donatur Unik  : ${d.total_donatur_unik} orang\n\n` +
      `🏆 Program Terpopuler:\n${topText}`
    );
  } catch (err) {
    await reply(sock, remoteJid, `❌ Gagal mengambil laporan: ${err.message}`);
  }
}

// ─── Handler: Sambutan ────────────────────────────────────────────────────────
async function handleSambutan(sock, remoteJid) {
  await reply(sock, remoteJid,
    `👋 *Assalamu'alaikum!*\n\n` +
    `Selamat datang di *Lazismu Tulungagung Bot* 🤖\n\n` +
    `Ketik *menu* atau *bantuan* untuk melihat daftar perintah yang tersedia.`
  );
}

// ─── Handler: Menu User ───────────────────────────────────────────────────────
async function handleMenu(sock, remoteJid) {
  await reply(sock, remoteJid,
    `📋 *MENU LAZISMU BOT*\n\n` +
    `🔍 Cek status donasi:\n  Ketik: \`cek INVOICE_ANDA\`\n\n` +
    `🏷️ Lihat program aktif:\n  Ketik: \`#program\`\n\n` +
    `💬 Hubungi admin:\n  Ketik: \`pesan\`\n\n` +
    `🌐 Website: temanamal.org\n` +
    `📷 Instagram: @lazismu.tulungagung`
  );
}

// ─── Handler: Default Reply ───────────────────────────────────────────────────
async function handleDefaultReply(sock, remoteJid) {
  await reply(sock, remoteJid,
    `Halo! 👋 Ketik *bantuan* atau *menu* untuk melihat fitur yang tersedia.\n\n` +
    `🌐 Website: temanamal.org\n` +
    `📷 Instagram: @lazismu.tulungagung`
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function adminHelpText() {
  return `🛡️ *PERINTAH ADMIN*\n\n` +
    `• \`!jawab|kode_user pesan\` — Balas pesan user\n` +
    `• \`!laporan\` — Laporan donasi hari ini\n` +
    `• \`!help\` — Tampilkan menu ini\n\n` +
    `_Anda terdaftar sebagai admin._`;
}

function reply(sock, jid, text) {
  return sock.sendMessage(jid, { text });
}

function formatRupiah(angka) {
  return Number(angka).toLocaleString('id-ID');
}

module.exports = { handleMessage };
