const cron = require('node-cron');
const axios = require('axios');
const { notifyLaporanHarian } = require('../handlers/notificationHandler');
const { logger } = require('../logger');

const PHP_BASE_URL = process.env.PHP_BASE_URL || 'http://localhost/temanamal';
const BOT_SECRET   = process.env.BOT_SECRET   || 'RAHASIAPIXELYOGA';
const ADMIN_WA     = process.env.ADMIN_WA      || '6285806917113';

/**
 * Mulai semua cron job terjadwal.
 */
function startScheduler() {
  // ─── Laporan Harian setiap pukul 20:00 WIB ─────────────────────────────
  cron.schedule('0 20 * * *', async () => {
    logger.info('[CRON] Mengirim laporan harian...');
    try {
      const res = await axios.get(`${PHP_BASE_URL}/api/laporan_harian.php`, {
        params: { secret: BOT_SECRET },
      });
      if (res.data?.success) {
        await notifyLaporanHarian({
          admin_wa:          ADMIN_WA,
          tanggal:           res.data.tanggal,
          total_donasi:      res.data.total_donasi,
          total_nominal:     res.data.total_nominal,
          total_donatur_unik: res.data.total_donatur_unik,
          top_program:       res.data.top_program,
        });
      }
    } catch (err) {
      logger.error(`[CRON] Laporan harian gagal: ${err.message}`);
    }
  }, { timezone: 'Asia/Jakarta' });

  // ─── Pengingat Donasi Belum Dikonfirmasi setiap pukul 10:00 WIB ────────
  cron.schedule('0 10 * * *', async () => {
    logger.info('[CRON] Cek donasi belum dikonfirmasi...');
    try {
      const res = await axios.get(`${PHP_BASE_URL}/api/donasi_pending.php`, {
        params: { secret: BOT_SECRET },
      });
      const pending = res.data?.pending || [];
      if (pending.length > 0) {
        const lines = pending.slice(0, 5).map(d =>
          `  • ${d.invoice} — Rp ${Number(d.nominal).toLocaleString('id-ID')} (${d.nama})`
        ).join('\n');
        const { sendMessage } = require('../bot');
        await sendMessage(ADMIN_WA,
          `⚠️ *DONASI BELUM DIKONFIRMASI*\n\n` +
          `Terdapat *${pending.length}* donasi menunggu konfirmasi:\n\n` +
          `${lines}\n\n` +
          `_Segera konfirmasi di dashboard admin._`
        );
      }
    } catch (err) {
      logger.error(`[CRON] Cek pending gagal: ${err.message}`);
    }
  }, { timezone: 'Asia/Jakarta' });

  logger.info('⏰ Scheduler aktif: Laporan (20:00 WIB) & Pengingat (10:00 WIB)');
}

module.exports = { startScheduler };
