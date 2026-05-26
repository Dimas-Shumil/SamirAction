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
    const file = await fs.readFile(path.join(dataPath, 'products.json'), 'utf8');
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
    const file = await fs.readFile(path.join(dataPath, 'products.json'), 'utf8');
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

app.post('/api/orders', async (req, res) => {
  try {
    const { type, name, phone, productId, size } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        message: 'Имя и телефон обязательны',
      });
    }

    const ordersFilePath = path.join(dataPath, 'orders.json');

    const file = await fs.readFile(ordersFilePath, 'utf8');
    const orders = JSON.parse(file || '[]');

    const newOrder = {
      id: Date.now().toString(),
      type: type || 'quick',
      name,
      phone,
      productId: productId || null,
      size: size || null,
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
  console.log(`Samir Action started: http://localhost:${PORT}`);
});
