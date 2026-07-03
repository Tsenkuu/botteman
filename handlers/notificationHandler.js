const { sendMessage } = require('../bot');

/**
 * Kirim notifikasi ke admin ketika ada donasi baru masuk.
 */
async function notifyDonasiBaru(data) {
  const {
    admin_wa,
    nama_donatur,
    nominal,
    program,
    metode,
    invoice,
    waktu,
  } = data;

  const pesan = `🔔 *DONASI BARU MASUK!*\n\n` +
    `📋 *Invoice:* ${invoice}\n` +
    `👤 *Donatur:* ${nama_donatur}\n` +
    `💰 *Nominal:* Rp ${formatRupiah(nominal)}\n` +
    `🏷️ *Program:* ${program}\n` +
    `💳 *Metode:* ${metode}\n` +
    `🕐 *Waktu:* ${waktu}\n\n` +
    `_Segera konfirmasi pembayaran di dashboard admin._`;

  await sendMessage(admin_wa, pesan);
}

/**
 * Kirim notifikasi ke donatur ketika donasi dikonfirmasi.
 */
async function notifyDonaturKonfirmasi(data) {
  const {
    nomor_hp,
    nama_donatur,
    nominal,
    program,
    invoice,
  } = data;

  const pesan = `✅ *DONASI ANDA TELAH DIKONFIRMASI!*\n\n` +
    `Assalamu'alaikum ${nama_donatur},\n\n` +
    `Alhamdulillah, donasi Anda telah kami terima dan dikonfirmasi.\n\n` +
    `📋 *Invoice:* ${invoice}\n` +
    `💰 *Nominal:* Rp ${formatRupiah(nominal)}\n` +
    `🏷️ *Program:* ${program}\n\n` +
    `Semoga menjadi amal yang berkah dan diterima Allah SWT. 🤲\n\n` +
    `*Lazismu Tulungagung*\n` +
    `📷 Instagram: @lazismu.tulungagung`;

  await sendMessage(nomor_hp, pesan);
}

/**
 * Kirim laporan ringkasan harian ke admin.
 */
async function notifyLaporanHarian(data) {
  const {
    admin_wa,
    tanggal,
    total_donasi,
    total_nominal,
    total_donatur_unik,
    top_program,
  } = data;

  const topProgramText = top_program?.length
    ? top_program.map((p, i) => `  ${i + 1}. ${p.nama} — Rp ${formatRupiah(p.total)}`).join('\n')
    : '  Belum ada donasi hari ini';

  const pesan = `📊 *LAPORAN HARIAN LAZISMU*\n` +
    `📅 ${tanggal}\n\n` +
    `┌─────────────────────┐\n` +
    `│ 💰 Total Nominal  : Rp ${formatRupiah(total_nominal)}\n` +
    `│ 📦 Jumlah Donasi  : ${total_donasi} transaksi\n` +
    `│ 👥 Donatur Unik   : ${total_donatur_unik} orang\n` +
    `└─────────────────────┘\n\n` +
    `🏆 *Program Terpopuler:*\n${topProgramText}\n\n` +
    `_Lihat detail di dashboard admin._`;

  await sendMessage(admin_wa, pesan);
}

/**
 * Kirim notifikasi pesan baru dari user ke admin.
 */
async function notifyPesanUserBaru(data) {
  const { admin_wa, kode_user, nama, pesan, waktu } = data;

  const teks = `💬 *PESAN BARU DARI USER*\n\n` +
    `👤 *Dari:* ${nama}\n` +
    `🔑 *Kode:* ${kode_user}\n` +
    `🕐 *Waktu:* ${waktu}\n\n` +
    `📩 *Pesan:*\n${pesan}\n\n` +
    `Balas dengan:\n\`!jawab|${kode_user} [balasan Anda]\``;

  await sendMessage(admin_wa, teks);
}

// ─── Util ────────────────────────────────────────────────────────────────────
function formatRupiah(angka) {
  return Number(angka).toLocaleString('id-ID');
}

module.exports = {
  notifyDonasiBaru,
  notifyDonaturKonfirmasi,
  notifyLaporanHarian,
  notifyPesanUserBaru,
};
