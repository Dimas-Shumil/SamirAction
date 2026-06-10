require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const rootPath = __dirname;
const pagesPath = path.join(rootPath, 'public');
const sitePath = path.join(rootPath, 'site');
const dataPath = path.join(rootPath, 'data');

const PRODUCTS_FILE = 'products.json';
const ORDERS_FILE = 'orders.json';

const allowedOrigins = String(
  process.env.ALLOWED_ORIGINS ||
    process.env.SITE_ORIGIN ||
    `http://localhost:${PORT}`,
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'self'"],
        'object-src': ["'none'"],
        'script-src': ["'self'"],
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'"],
        'form-action': ["'self'"],
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked: ${origin}`));
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  }),
);

app.use(
  express.json({
    limit: '50kb',
    strict: true,
  }),
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '50kb',
  }),
);

app.use((req, res, next) => {
  const blockedPaths = [
    '/data',
    '/.env',
    '/server.js',
    '/package.json',
    '/package-lock.json',
    '/node_modules',
  ];

  if (blockedPaths.some((blockedPath) => req.path.startsWith(blockedPath))) {
    return res.status(404).send('Not found');
  }

  next();
});

app.use(
  '/site',
  express.static(sitePath, {
    index: false,
    dotfiles: 'deny',
    maxAge: NODE_ENV === 'production' ? '7d' : 0,
  }),
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 250,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Слишком много запросов. Попробуйте позже.',
  },
});

const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Слишком много заявок. Попробуйте чуть позже.',
  },
});

app.use('/api', apiLimiter);

function sendPage(res, pageName) {
  return res.sendFile(path.join(pagesPath, pageName));
}

function createId() {
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

function normalizeString(value, maxLength = 120) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function normalizeMessage(value, maxLength = 1000) {
  return String(value || '')
    .trim()
    .replace(/\r\n/g, '\n')
    .slice(0, maxLength);
}

function normalizeQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  return Math.min(quantity, 99);
}

function normalizePhone(value) {
  const rawPhone = normalizeString(value, 40);
  const digits = rawPhone.replace(/\D/g, '');

  if (
    digits.length === 11 &&
    (digits.startsWith('7') || digits.startsWith('8'))
  ) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  return null;
}

function isValidName(name) {
  return name.length >= 2 && name.length <= 80;
}

function isHoneypotFilled(body) {
  return Boolean(
    normalizeString(body.website, 200) ||
    normalizeString(body.company, 200) ||
    normalizeString(body.url, 200),
  );
}

function isTooFast(body, minMs = 2000) {
  const startedAt = Number(body.formStartedAt);

  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return false;
  }

  return Date.now() - startedAt < minMs;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (symbol) => {
    const symbols = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };

    return symbols[symbol];
  });
}

async function ensureDataDir() {
  await fs.mkdir(dataPath, { recursive: true });
}

async function ensureJsonFile(fileName, fallback = []) {
  await ensureDataDir();

  const filePath = path.join(dataPath, fileName);

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), 'utf8');
  }
}

async function readJsonFile(fileName, fallback = []) {
  await ensureJsonFile(fileName, fallback);

  const filePath = path.join(dataPath, fileName);
  const file = await fs.readFile(filePath, 'utf8');

  if (!file.trim()) {
    return fallback;
  }

  return JSON.parse(file);
}

async function writeJsonFile(fileName, data) {
  await ensureDataDir();

  const filePath = path.join(dataPath, fileName);
  const tempFilePath = `${filePath}.tmp`;

  await fs.writeFile(tempFilePath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tempFilePath, filePath);
}

let ordersWriteQueue = Promise.resolve();

function appendOrder(order) {
  ordersWriteQueue = ordersWriteQueue.then(async () => {
    const orders = await readJsonFile(ORDERS_FILE, []);

    orders.unshift(order);

    await writeJsonFile(ORDERS_FILE, orders.slice(0, 1000));
  });

  return ordersWriteQueue;
}

function buildOrderItems(body, products) {
  const rawItems =
    Array.isArray(body.items) && body.items.length
      ? body.items
      : body.productId
        ? [
            {
              id: body.productId,
              size: body.size,
              quantity: body.quantity || 1,
            },
          ]
        : [];

  const requestItems = rawItems.slice(0, 50);
  const preparedItems = [];

  requestItems.forEach((item) => {
    const productId = normalizeString(item.id || item.productId, 100);

    if (!productId) return;

    const product = products.find((productItem) => {
      return productItem.id === productId && productItem.available;
    });

    if (!product) return;

    const size = item.size ? normalizeString(item.size, 20) : null;

    if (product.sizes?.length && size && !product.sizes.includes(size)) {
      return;
    }

    const quantity = normalizeQuantity(item.quantity);

    preparedItems.push({
      id: product.id,
      title: product.title,
      size,
      quantity,
      price: Number(product.price) || 0,
      total: (Number(product.price) || 0) * quantity,
    });
  });

  const mergedItems = [];

  preparedItems.forEach((item) => {
    const existingItem = mergedItems.find((mergedItem) => {
      return mergedItem.id === item.id && mergedItem.size === item.size;
    });

    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.total = existingItem.price * existingItem.quantity;
      return;
    }

    mergedItems.push(item);
  });

  return mergedItems;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function formatOrderEmail(order) {
  const orderType = order.type === 'cart' ? 'Корзина' : 'Быстрый заказ';

  const itemsRows = order.items.length
    ? order.items
        .map((item) => {
          return `
            <tr>
              <td style="padding:16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-size:15px;font-weight:800;color:#ffffff;line-height:1.35;">
                  ${escapeHtml(item.title)}
                </div>
                <div style="margin-top:5px;font-size:12px;color:#aab4c3;">
                  ID: ${escapeHtml(item.id)}
                </div>
              </td>

              <td style="padding:16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;">
                <span style="display:inline-block;padding:6px 10px;border:1px solid rgba(0,102,255,0.45);border-radius:999px;color:#ffffff;font-size:13px;font-weight:800;background:rgba(0,102,255,0.12);">
                  ${escapeHtml(item.size || '—')}
                </span>
              </td>

              <td style="padding:16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:center;color:#ffffff;font-size:14px;font-weight:800;">
                ${item.quantity}
              </td>

              <td style="padding:16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right;color:#aab4c3;font-size:14px;">
                ${formatMoney(item.price)}
              </td>

              <td style="padding:16px 14px;border-bottom:1px solid rgba(255,255,255,0.08);text-align:right;color:#ffffff;font-size:15px;font-weight:900;">
                ${formatMoney(item.total)}
              </td>
            </tr>
          `;
        })
        .join('')
    : `
      <tr>
        <td colspan="5" style="padding:22px 16px;border-bottom:1px solid rgba(255,255,255,0.08);color:#aab4c3;text-align:center;">
          Клиент оставил быструю заявку без выбранного товара
        </td>
      </tr>
    `;

  const text = `
Новая заявка SAMIR WRESTLING

Номер заявки: ${order.id}
Тип заявки: ${orderType}
Имя: ${order.name}
Телефон: ${order.phone}
Сумма: ${formatMoney(order.total)}
Дата: ${order.createdAt}

Товары:
${
  order.items.length
    ? order.items
        .map((item) => {
          return `- ${item.title}, размер: ${item.size || '—'}, кол-во: ${item.quantity}, сумма: ${formatMoney(item.total)}`;
        })
        .join('\n')
    : 'Клиент оставил заявку без выбора товара'
}
  `.trim();

  const html = `
    <div style="margin:0;padding:0;background:#03070d;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#03070d;padding:32px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 18px 0;">
                  <div style="display:inline-block;padding:8px 12px;border:1px solid rgba(0,102,255,0.45);border-radius:999px;background:rgba(0,102,255,0.12);color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">
                    SAMIR WRESTLING
                  </div>
                </td>
              </tr>

              <tr>
                <td style="overflow:hidden;border:1px solid rgba(0,102,255,0.35);border-radius:24px;background:#07111d;box-shadow:0 24px 70px rgba(0,0,0,0.45);">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:34px 32px;background:linear-gradient(135deg,#07111d 0%,#03070d 58%,rgba(0,102,255,0.32) 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="color:#0066ff;font-size:13px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;">
                          Новая заявка
                        </div>

                        <h1 style="margin:10px 0 0 0;color:#ffffff;font-size:30px;line-height:1.1;font-weight:900;text-transform:uppercase;">
                          Заказ с сайта
                        </h1>

                        <p style="margin:12px 0 0 0;color:#aab4c3;font-size:15px;line-height:1.55;">
                          Клиент оставил заявку на экипировку. Ниже данные для быстрой обработки.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:26px 32px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Номер заявки</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:14px;font-weight:800;text-align:right;">${escapeHtml(order.id)}</td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Тип заявки</td>
                            <td style="padding:12px 0;text-align:right;">
                              <span style="display:inline-block;padding:7px 12px;border-radius:999px;background:#0066ff;color:#ffffff;font-size:12px;font-weight:900;text-transform:uppercase;">
                                ${escapeHtml(orderType)}
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Имя</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:16px;font-weight:900;text-align:right;">${escapeHtml(order.name)}</td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Телефон</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:18px;font-weight:900;text-align:right;">
                              <a href="tel:${escapeHtml(order.phone)}" style="color:#ffffff;text-decoration:none;">
                                ${escapeHtml(order.phone)}
                              </a>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Дата</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(order.createdAt)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 32px 28px 32px;">
                        <div style="border:1px solid rgba(255,255,255,0.08);border-radius:18px;overflow:hidden;background:rgba(3,7,13,0.58);">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                            <thead>
                              <tr style="background:rgba(0,102,255,0.16);">
                                <th style="padding:14px;text-align:left;color:#aab4c3;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Товар</th>
                                <th style="padding:14px;text-align:center;color:#aab4c3;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Размер</th>
                                <th style="padding:14px;text-align:center;color:#aab4c3;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Кол-во</th>
                                <th style="padding:14px;text-align:right;color:#aab4c3;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Цена</th>
                                <th style="padding:14px;text-align:right;color:#aab4c3;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Итого</th>
                              </tr>
                            </thead>

                            <tbody>
                              ${itemsRows}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 32px 34px 32px;">
                        <div style="padding:22px;border:1px solid rgba(0,102,255,0.45);border-radius:18px;background:linear-gradient(135deg,rgba(0,102,255,0.2),rgba(0,102,255,0.05));">
                          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                            <tr>
                              <td style="color:#aab4c3;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">
                                Сумма заказа
                              </td>

                              <td style="color:#ffffff;font-size:28px;font-weight:900;text-align:right;">
                                ${formatMoney(order.total)}
                              </td>
                            </tr>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 4px 0 4px;color:#596579;font-size:12px;line-height:1.5;text-align:center;">
                  Это автоматическое уведомление с сайта SAMIR WRESTLING.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

function formatContactEmail(contact) {
  const text = `
Новое сообщение с сайта SAMIR WRESTLING

Имя: ${contact.name}
Телефон: ${contact.phone}
Сообщение:
${contact.message}

Дата: ${contact.createdAt}
  `.trim();

  const html = `
    <div style="margin:0;padding:0;background:#03070d;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#03070d;padding:32px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;border-collapse:collapse;">
              <tr>
                <td style="padding:0 0 18px 0;">
                  <div style="display:inline-block;padding:8px 12px;border:1px solid rgba(0,102,255,0.45);border-radius:999px;background:rgba(0,102,255,0.12);color:#ffffff;font-size:12px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">
                    SAMIR WRESTLING
                  </div>
                </td>
              </tr>

              <tr>
                <td style="overflow:hidden;border:1px solid rgba(0,102,255,0.35);border-radius:24px;background:#07111d;box-shadow:0 24px 70px rgba(0,0,0,0.45);">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="padding:34px 32px;background:linear-gradient(135deg,#07111d 0%,#03070d 58%,rgba(0,102,255,0.32) 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
                        <div style="color:#0066ff;font-size:13px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;">
                          Новое сообщение
                        </div>

                        <h1 style="margin:10px 0 0 0;color:#ffffff;font-size:30px;line-height:1.1;font-weight:900;text-transform:uppercase;">
                          Контактная форма
                        </h1>

                        <p style="margin:12px 0 0 0;color:#aab4c3;font-size:15px;line-height:1.55;">
                          Клиент написал с сайта. Нужно связаться и обработать обращение.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:26px 32px;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Имя</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:16px;font-weight:900;text-align:right;">${escapeHtml(contact.name)}</td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Телефон</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:18px;font-weight:900;text-align:right;">
                              <a href="tel:${escapeHtml(contact.phone)}" style="color:#ffffff;text-decoration:none;">
                                ${escapeHtml(contact.phone)}
                              </a>
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:12px 0;color:#aab4c3;font-size:13px;">Дата</td>
                            <td style="padding:12px 0;color:#ffffff;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(contact.createdAt)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style="padding:0 32px 34px 32px;">
                        <div style="padding:22px;border:1px solid rgba(0,102,255,0.35);border-radius:18px;background:rgba(3,7,13,0.58);">
                          <div style="margin-bottom:10px;color:#0066ff;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;">
                            Сообщение клиента
                          </div>

                          <div style="color:#ffffff;font-size:16px;line-height:1.65;">
                            ${escapeHtml(contact.message).replace(/\n/g, '<br>')}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 4px 0 4px;color:#596579;font-size:12px;line-height:1.5;text-align:center;">
                  Это автоматическое уведомление с сайта SAMIR WRESTLING.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return { text, html };
}

async function sendMail({ subject, text, html }) {
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.TO_EMAIL
  ) {
    throw new Error('SMTP env is not configured');
  }

  return transporter.sendMail({
    from: `"SAMIR WRESTLING" <${process.env.SMTP_USER}>`,
    to: process.env.TO_EMAIL,
    subject,
    text,
    html,
  });
}

async function verifySmtp() {
  try {
    await transporter.verify();
    console.log('SMTP готов к отправке писем');
  } catch (error) {
    console.error('SMTP ошибка:', error.message);
  }
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'samir-wrestling',
    env: NODE_ENV,
  });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  return res.sendFile(path.join(pagesPath, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  return res.sendFile(path.join(pagesPath, 'sitemap.xml'));
});

// Pages
app.get('/', (req, res) => sendPage(res, 'index.html'));
app.get('/catalog', (req, res) => sendPage(res, 'catalog.html'));
app.get('/cart', (req, res) => sendPage(res, 'cart.html'));
app.get('/delivery', (req, res) => sendPage(res, 'delivery.html'));
app.get('/contacts', (req, res) => sendPage(res, 'contacts.html'));
app.get('/privacy-policy', (req, res) => sendPage(res, 'privacy-policy.html'));
app.get('/offer', (req, res) => sendPage(res, 'offer.html'));

app.get('/product/:slug', (req, res) => {
  return sendPage(res, 'product.html');
});

// API products
app.get('/api/products', async (req, res) => {
  try {
    const products = await readJsonFile(PRODUCTS_FILE, []);

    res.json(products);
  } catch (error) {
    console.error('Products read error:', error);

    res.status(500).json({
      message: 'Не удалось получить товары',
    });
  }
});

app.get('/api/products/:slug', async (req, res) => {
  try {
    const slug = normalizeString(req.params.slug, 120);
    const products = await readJsonFile(PRODUCTS_FILE, []);
    const product = products.find((item) => item.slug === slug);

    if (!product) {
      return res.status(404).json({
        message: 'Товар не найден',
      });
    }

    res.json(product);
  } catch (error) {
    console.error('Product read error:', error);

    res.status(500).json({
      message: 'Не удалось получить товар',
    });
  }
});

// API orders
app.post('/api/orders', formLimiter, async (req, res) => {
  try {
    if (isHoneypotFilled(req.body)) {
      return res.status(200).json({
        message: 'Заявка успешно создана',
      });
    }

    if (isTooFast(req.body)) {
      return res.status(400).json({
        message: 'Форма отправлена слишком быстро',
      });
    }

    const name = normalizeString(req.body.name, 80);
    const phone = normalizePhone(req.body.phone);
    const type = req.body.type === 'cart' ? 'cart' : 'quick';

    if (!isValidName(name)) {
      return res.status(400).json({
        message: 'Введите корректное имя',
      });
    }

    if (!phone) {
      return res.status(400).json({
        message: 'Введите корректный телефон',
      });
    }

    if (req.body.privacyAccepted !== 'yes') {
      return res.status(400).json({
        message:
          'Необходимо согласиться с политикой конфиденциальности, обработкой персональных данных и публичной офертой',
      });
    }

    const products = await readJsonFile(PRODUCTS_FILE, []);
    const items = buildOrderItems(req.body, products);

    if (type === 'cart' && !items.length) {
      return res.status(400).json({
        message: 'Корзина пуста или товары не найдены',
      });
    }

    if (req.body.productId && !items.length) {
      return res.status(400).json({
        message: 'Товар не найден или недоступен',
      });
    }

    const total = items.reduce((sum, item) => sum + item.total, 0);

    const newOrder = {
      id: createId(),
      type,
      name,
      phone,
      productId: type === 'quick' ? items[0]?.id || null : null,
      size: type === 'quick' ? items[0]?.size || null : null,
      items,
      total,
      status: 'new',
      source: 'website',
      ip: req.ip,
      userAgent: normalizeString(req.get('user-agent'), 300),
      createdAt: new Date().toISOString(),
    };

    await appendOrder(newOrder);

    let mailSent = true;

    try {
      const email = formatOrderEmail(newOrder);

      await sendMail({
        subject: `Новая заявка SAMIR WRESTLING №${newOrder.id}`,
        text: email.text,
        html: email.html,
      });
    } catch (mailError) {
      mailSent = false;
      console.error('Order email send error:', mailError.message);
    }

    res.status(201).json({
      message: 'Заявка успешно создана',
      mailSent,
    });
  } catch (error) {
    console.error('Order create error:', error);

    res.status(500).json({
      message: 'Не удалось создать заявку',
    });
  }
});

// API contacts
app.post('/api/contact', formLimiter, async (req, res) => {
  try {
    if (isHoneypotFilled(req.body)) {
      return res.status(200).json({
        message: 'Сообщение отправлено',
      });
    }

    if (isTooFast(req.body)) {
      return res.status(400).json({
        message: 'Форма отправлена слишком быстро',
      });
    }

    const name = normalizeString(req.body.name, 80);
    const phone = normalizePhone(req.body.phone);
    const message = normalizeMessage(req.body.message, 1000);

    if (!isValidName(name)) {
      return res.status(400).json({
        message: 'Введите корректное имя',
      });
    }

    if (!phone) {
      return res.status(400).json({
        message: 'Введите корректный телефон',
      });
    }

    if (message.length < 5) {
      return res.status(400).json({
        message: 'Введите сообщение',
      });
    }

    if (req.body.privacyAccepted !== 'yes') {
      return res.status(400).json({
        message: 'Необходимо согласие с политикой конфиденциальности',
      });
    }

    const contact = {
      id: createId(),
      name,
      phone,
      message,
      source: 'contacts',
      ip: req.ip,
      userAgent: normalizeString(req.get('user-agent'), 300),
      createdAt: new Date().toISOString(),
    };

    const email = formatContactEmail(contact);

    await sendMail({
      subject: `Сообщение с сайта SAMIR WRESTLING от ${contact.name}`,
      text: email.text,
      html: email.html,
    });

    res.status(201).json({
      message: 'Сообщение отправлено',
    });
  } catch (error) {
    console.error('Contact form error:', error);

    res.status(500).json({
      message: 'Не удалось отправить сообщение',
    });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'API route not found',
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(pagesPath, 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('Server error:', error.message);

  res.status(500).json({
    message: 'Внутренняя ошибка сервера',
  });
});

async function startServer() {
  await ensureJsonFile(ORDERS_FILE, []);

  app.listen(PORT, async () => {
    console.log(`Samir Wrestling started: http://localhost:${PORT}`);
    await verifySmtp();
  });
}

startServer().catch((error) => {
  console.error('Start server error:', error);
  process.exit(1);
});
