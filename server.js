require('dotenv').config();

const path = require('path');
const fs = require('fs/promises');
const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;

const rootPath = __dirname;
const pagesPath = path.join(rootPath, 'public');
const sitePath = path.join(rootPath, 'site');
const dataPath = path.join(rootPath, 'data');

app.use(express.json());

app.use('/site', express.static(sitePath));

function sendPage(res, pageName) {
  return res.sendFile(path.join(pagesPath, pageName));
}

// Pages
app.get('/', (req, res) => sendPage(res, 'index.html'));
app.get('/catalog', (req, res) => sendPage(res, 'catalog.html'));
app.get('/cart', (req, res) => sendPage(res, 'cart.html'));
app.get('/delivery', (req, res) => sendPage(res, 'delivery.html'));
app.get('/contacts', (req, res) => sendPage(res, 'contacts.html'));
app.get('/privacy-policy', (req, res) => sendPage(res, 'privacy-policy.html'));

app.get('/product/:slug', (req, res) => {
  return sendPage(res, 'product.html');
});

// API
app.get('/api/products', async (req, res) => {
  try {
    const file = await fs.readFile(
      path.join(dataPath, 'products.json'),
      'utf8',
    );
    const products = JSON.parse(file);

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
    const file = await fs.readFile(
      path.join(dataPath, 'products.json'),
      'utf8',
    );
    const products = JSON.parse(file);

    const product = products.find((item) => item.slug === req.params.slug);

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

//  апи для модалки

function normalizeString(value, maxLength = 120) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function normalizeQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1;
  }

  return Math.min(quantity, 99);
}

async function readJsonFile(fileName, fallback = []) {
  try {
    const file = await fs.readFile(path.join(dataPath, fileName), 'utf8');

    return JSON.parse(file || JSON.stringify(fallback));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }

    throw error;
  }
}

function buildOrderItems(body, products) {
  const requestItems =
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

  const preparedItems = [];

  requestItems.forEach((item) => {
    const productId = normalizeString(item.id || item.productId, 100);
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
      price: product.price,
      total: product.price * quantity,
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

app.post('/api/orders', async (req, res) => {
  try {
    const name = normalizeString(req.body.name, 80);
    const phone = normalizeString(req.body.phone, 40);
    const type = req.body.type === 'cart' ? 'cart' : 'quick';

    if (!name || !phone) {
      return res.status(400).json({
        message: 'Имя и телефон обязательны',
      });
    }

    const products = await readJsonFile('products.json', []);
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

    const ordersFilePath = path.join(dataPath, 'orders.json');
    const orders = await readJsonFile('orders.json', []);

    const newOrder = {
      id: Date.now().toString(),
      type,
      name,
      phone,
      productId: type === 'quick' ? items[0]?.id || null : null,
      size: type === 'quick' ? items[0]?.size || null : null,
      items,
      total,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    orders.unshift(newOrder);

    await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));

    res.status(201).json({
      message: 'Заявка успешно создана',
      order: newOrder,
    });
  } catch (error) {
    console.error('Order create error:', error);

    res.status(500).json({
      message: 'Не удалось создать заявку',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Samir Wrestling started: http://localhost:${PORT}`);
});
