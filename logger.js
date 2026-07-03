const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Format standar untuk semua log
const logFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}${info.stack ? '\n' + info.stack : ''}`)
);

// Transport untuk console dengan warna
const consoleTransport = new transports.Console({
  format: format.combine(
    format.colorize(),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
  ),
});

// Transport rotasi harian untuk error
const errorRotateTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error'
});

// Transport rotasi harian untuk aplikasi utama
const appRotateTransport = new DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Transport rotasi harian khusus koneksi WhatsApp
const connectionRotateTransport = new DailyRotateFile({
  filename: 'logs/connection-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Transport rotasi harian untuk request HTTP Express
const requestRotateTransport = new DailyRotateFile({
  filename: 'logs/request-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Logger utama
const logger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    consoleTransport,
    errorRotateTransport,
    appRotateTransport
  ]
});

// Logger khusus untuk koneksi WA
const connectionLogger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    consoleTransport,
    errorRotateTransport,
    connectionRotateTransport
  ]
});

// Logger khusus untuk Express Requests
const requestLogger = createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    consoleTransport,
    requestRotateTransport
  ]
});

module.exports = {
  logger,
  connectionLogger,
  requestLogger
};
