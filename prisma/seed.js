const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const rootPath = path.join(__dirname, '..');
const productsPath = path.join(rootPath, 'data', 'products.json');
const ordersPath = path.join(rootPath, 'data', 'orders.json');

function toJsonString(value, fallback = []) {
  try {
    return JSON.stringify(Array.isArray(value) ? value : fallback);
  } catch {
    return JSON.stringify(fallback);
  }
}

function toNullableString(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(Math.round(number), 0);
}

function toNullableNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.max(Math.round(number), 0);
}

function toDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  return date;
}

async function readJson(filePath, fallback = []) {
  try {
    const file = await fs.readFile(filePath, 'utf8');

    if (!file.trim()) {
      return fallback;
    }

    return JSON.parse(file);
  } catch (error) {
    console.warn(`Не удалось прочитать ${filePath}:`, error.message);
    return fallback;
  }
}

async function seedProducts() {
  const products = await readJson(productsPath, []);

  console.log(`Найдено товаров в JSON: ${products.length}`);

  for (const [index, product] of products.entries()) {
    const id = toNullableString(product.id) || toNullableString(product.slug);

    if (!id || !product.slug || !product.title) {
      console.warn('Пропущен товар без id/slug/title:', product);
      continue;
    }

    await prisma.product.upsert({
      where: {
        id,
      },
      update: {
        slug: String(product.slug).trim(),
        title: String(product.title).trim(),

        seoTitle: toNullableString(product.seoTitle),
        seoDescription: toNullableString(product.seoDescription),

        category: String(product.category || 'products').trim(),
        categoryTitle: String(product.categoryTitle || 'Товары').trim(),

        price: toNumber(product.price),
        oldPrice: toNullableNumber(product.oldPrice),

        badge: toNullableString(product.badge),
        isPopular: Boolean(product.isPopular),
        available: product.available !== false,

        bundle: toNullableString(product.bundle),
        color: toNullableString(product.color),
        sizesJson: toJsonString(product.sizes, []),
        imagesJson: toJsonString(product.images, []),

        shortDescription: toNullableString(product.shortDescription),
        description: toNullableString(product.description),
        material: toNullableString(product.material),
        sku: toNullableString(product.sku),

        sortOrder: toNumber(product.sortOrder, index + 1),

        // Старые товары уже были на сайте, поэтому не отправляем их на 12 часов проверки
        publishAfter: null,
      },
      create: {
        id,
        slug: String(product.slug).trim(),
        title: String(product.title).trim(),

        seoTitle: toNullableString(product.seoTitle),
        seoDescription: toNullableString(product.seoDescription),

        category: String(product.category || 'products').trim(),
        categoryTitle: String(product.categoryTitle || 'Товары').trim(),

        price: toNumber(product.price),
        oldPrice: toNullableNumber(product.oldPrice),

        badge: toNullableString(product.badge),
        isPopular: Boolean(product.isPopular),
        available: product.available !== false,

        bundle: toNullableString(product.bundle),
        color: toNullableString(product.color),
        sizesJson: toJsonString(product.sizes, []),
        imagesJson: toJsonString(product.images, []),

        shortDescription: toNullableString(product.shortDescription),
        description: toNullableString(product.description),
        material: toNullableString(product.material),
        sku: toNullableString(product.sku),

        sortOrder: toNumber(product.sortOrder, index + 1),

        // Старые товары сразу публичные
        publishAfter: null,
      },
    });
  }

  console.log('Товары перенесены в Prisma');
}

async function seedOrders() {
  const orders = await readJson(ordersPath, []);

  console.log(`Найдено заявок в JSON: ${orders.length}`);

  for (const order of orders) {
    const id = toNullableString(order.id);

    if (!id) {
      console.warn('Пропущена заявка без id:', order);
      continue;
    }

    await prisma.order.upsert({
      where: {
        id,
      },
      update: {
        type: String(order.type || 'quick').trim(),
        name: String(order.name || 'Без имени').trim(),
        phone: String(order.phone || '').trim(),

        productId: toNullableString(order.productId),
        size: toNullableString(order.size),

        itemsJson: toJsonString(order.items, []),
        total: toNumber(order.total),

        status: String(order.status || 'new').trim(),
        source: toNullableString(order.source),

        ip: toNullableString(order.ip),
        userAgent: toNullableString(order.userAgent),

        createdAt: toDate(order.createdAt),
      },
      create: {
        id,

        type: String(order.type || 'quick').trim(),
        name: String(order.name || 'Без имени').trim(),
        phone: String(order.phone || '').trim(),

        productId: toNullableString(order.productId),
        size: toNullableString(order.size),

        itemsJson: toJsonString(order.items, []),
        total: toNumber(order.total),

        status: String(order.status || 'new').trim(),
        source: toNullableString(order.source),

        ip: toNullableString(order.ip),
        userAgent: toNullableString(order.userAgent),

        createdAt: toDate(order.createdAt),
      },
    });
  }

  console.log('Заявки перенесены в Prisma');
}

async function main() {
  await seedProducts();
  await seedOrders();

  const productsCount = await prisma.product.count();
  const ordersCount = await prisma.order.count();

  console.log('Готово');
  console.log(`Товаров в базе: ${productsCount}`);
  console.log(`Заявок в базе: ${ordersCount}`);
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
