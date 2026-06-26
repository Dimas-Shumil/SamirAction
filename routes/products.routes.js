const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeProduct(product) {
  if (!product) {
    return null;
  }

  const { sizesJson, imagesJson, ...publicProduct } = product;

  return {
    ...publicProduct,
    sizes: parseJsonArray(sizesJson),
    images: parseJsonArray(imagesJson),
  };
}

function getPublicProductWhere(extraWhere = {}) {
  const now = new Date();

  return {
    available: true,
    OR: [
      {
        publishAfter: null,
      },
      {
        publishAfter: {
          lte: now,
        },
      },
    ],
    ...extraWhere,
  };
}

router.get('/', async (req, res) => {
  try {
    const category = String(req.query.category || '').trim();

    const products = await prisma.product.findMany({
      where: getPublicProductWhere(
        category
          ? {
              category,
            }
          : {}
      ),
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    res.json(products.map(normalizeProduct));
  } catch (error) {
    console.error('Products API error:', error);
    res.status(500).json({
      message: 'Не удалось загрузить товары',
    });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim();

    const product = await prisma.product.findFirst({
      where: getPublicProductWhere({
        slug,
      }),
    });

    if (!product) {
      return res.status(404).json({
        message: 'Товар не найден',
      });
    }

    res.json(normalizeProduct(product));
  } catch (error) {
    console.error('Product API error:', error);
    res.status(500).json({
      message: 'Не удалось загрузить товар',
    });
  }
});

module.exports = router;
