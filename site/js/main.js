const header = document.querySelector('.header');
const burger = document.querySelector('.header__burger');

let lastScrollY = window.scrollY;

if (header && burger) {
  burger.addEventListener('click', () => {
    const isOpen = burger.classList.toggle('is-open');

    header.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);

    burger.setAttribute('aria-expanded', String(isOpen));
    burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
  });

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const isMenuOpen = header.classList.contains('is-open');

    if (isMenuOpen) return;

    if (currentScrollY > lastScrollY && currentScrollY > 120) {
      header.classList.add('is-hidden');
    } else {
      header.classList.remove('is-hidden');
    }

    lastScrollY = currentScrollY;
  });
}
// рендер на главную страницу хитов продаж

async function loadPopularProducts() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();

    const popularProducts = products.filter(
      (product) => product.isPopular && product.available,
    );

    renderPopularProducts(popularProducts);
  } catch (error) {
    console.error('Products loading error:', error);
  }
}

function renderPopularProducts(products) {
  const container = document.querySelector('#popularProducts');

  if (!container) return;

  container.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          <a href="/product/${product.slug}" class="product-card__image">
            <img src="${product.images[0]}" alt="${product.title}" loading="lazy" />
          </a>

          ${
            product.badge
              ? `<div class="product-card__badge">${product.badge}</div>`
              : ''
          }

          <div class="product-card__content">
            <p class="product-card__category">${product.categoryTitle}</p>

            <h3 class="product-card__title">
              <a href="/product/${product.slug}">
                ${product.title}
              </a>
            </h3>

            <div class="product-card__prices">
              ${
                product.oldPrice
                  ? `<span>${product.oldPrice.toLocaleString('ru-RU')} ₽</span>`
                  : ''
              }

              <strong>${product.price.toLocaleString('ru-RU')} ₽</strong>
            </div>

            ${
              product.sizes?.length
                ? `
                  <div class="product-card__sizes">
                    ${product.sizes
                      .map(
                        (size, index) => `
                          <button
                            class="product-card__size ${index === 0 ? 'active' : ''}"
                            type="button"
                            data-product-id="${product.id}"
                            data-size="${size}"
                          >
                            ${size}
                          </button>
                        `,
                      )
                      .join('')}
                  </div>
                `
                : ''
            }

            <div class="product-card__actions">
              <button
                class="product-card__button product-card__button--cart"
                type="button"
                data-product-id="${product.id}"
              >
                В корзину
              </button>

              <button
                class="product-card__button product-card__button--quick"
                type="button"
                data-product-id="${product.id}"
              >
                Быстрый заказ
              </button>
            </div>
          </div>
        </article>
      `,
    )
    .join('');
}

document.addEventListener('click', (event) => {
  const sizeButton = event.target.closest('.product-card__size');

  if (!sizeButton) return;

  const sizesWrapper = sizeButton.closest('.product-card__sizes');

  sizesWrapper.querySelectorAll('.product-card__size').forEach((button) => {
    button.classList.remove('active');
  });

  sizeButton.classList.add('active');
});

loadPopularProducts();

// рендер в секци собери комплект

let bundleProducts = [];

async function loadBundleProducts() {
  try {
    const response = await fetch('/api/products');
    const products = await response.json();

    bundleProducts = products.filter(
      (product) => product.bundle === 'training-set' && product.available,
    );

    renderBundleProducts(bundleProducts);
  } catch (error) {
    console.error('Bundle loading error:', error);
  }
}

function renderBundleProducts(products) {
  const container = document.querySelector('#bundleProducts');
  const benefitElement = document.querySelector('#bundleBenefit');

  if (!container) return;

  container.innerHTML = products
    .map(
      (product, index) => `
        ${index > 0 ? '<span class="bundle__sign">+</span>' : ''}

        <article class="bundle__product">
          <img src="${product.images[0]}" alt="${product.title}" loading="lazy" />

          <div>
            <h3>${product.title}</h3>
            <strong>${product.price.toLocaleString('ru-RU')} ₽</strong>
          </div>
        </article>
      `,
    )
    .join('');

  const oldTotal = products.reduce(
    (total, product) => total + (product.oldPrice || product.price),
    0,
  );

  const currentTotal = products.reduce(
    (total, product) => total + product.price,
    0,
  );

  const benefit = oldTotal - currentTotal;

  if (benefitElement) {
    benefitElement.textContent = `${benefit.toLocaleString('ru-RU')} ₽`;
  }
}

document.addEventListener('click', (event) => {
  const bundleButton = event.target.closest('#addBundleToCart');

  if (!bundleButton) return;

  bundleProducts.forEach((product) => {
    const defaultSize = product.sizes?.[0] || null;

    addToCart(product.id, defaultSize);
  });
});

loadBundleProducts();

// модалка
// модалка быстрого заказа

let allProducts = [];

async function getProducts() {
  if (allProducts.length) return allProducts;

  const response = await fetch('/api/products');
  allProducts = await response.json();

  return allProducts;
}

function showToast(title, text, type = 'success') {
  const toast = document.querySelector('#toast');

  if (!toast) return;

  toast.classList.remove('toast--success', 'toast--error');
  toast.classList.add(`toast--${type}`);

  toast.querySelector('.toast__icon').textContent =
    type === 'success' ? '✓' : '✕';

  toast.querySelector('strong').textContent = title;
  toast.querySelector('span').textContent = text;

  toast.classList.add('active');

  clearTimeout(toast.hideTimeout);

  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('active');
  }, 3200);
}

async function openQuickOrder(productId = null, size = null) {
  const modal = document.querySelector('#quickOrderModal');
  const productBox = document.querySelector('#quickOrderProduct');
  const productIdInput = document.querySelector('#quickProductId');
  const productSizeInput = document.querySelector('#quickProductSize');

  if (!modal) return;

  let product = null;

  if (productId) {
    const products = await getProducts();
    product = products.find((item) => item.id === productId);
  }

  if (product) {
    productIdInput.value = product.id;
    productSizeInput.value = size || '';

    productBox.innerHTML = `
      <img src="${product.images[0]}" alt="${product.title}" />
      <div>
        <strong>${product.title}</strong>
        <span>${product.price.toLocaleString('ru-RU')} ₽${size ? ` · ${size}` : ''}</span>
      </div>
    `;
  } else {
    productIdInput.value = '';
    productSizeInput.value = '';

    productBox.innerHTML = `
      <div>
        <strong>Быстрый заказ</strong>
        <span>Менеджер поможет подобрать товар</span>
      </div>
    `;
  }

  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeQuickOrder() {
  const modal = document.querySelector('#quickOrderModal');

  if (!modal) return;

  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

document.addEventListener('click', async (event) => {
  const quickButton = event.target.closest('.product-card__button--quick');
  const heroQuickButton = event.target.closest('.quick-order-trigger');
  const closeButton = event.target.closest('[data-quick-close]');

  if (closeButton) {
    closeQuickOrder();
    return;
  }

  if (quickButton) {
    const productId = quickButton.dataset.productId;
    const card = quickButton.closest('.product-card');
    const activeSize = card?.querySelector('.product-card__size.active');
    const size = activeSize?.dataset.size || null;

    await openQuickOrder(productId, size);
    return;
  }

  if (heroQuickButton) {
    await openQuickOrder();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeQuickOrder();
  }
});

document
  .querySelector('#quickOrderForm')
  ?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const orderData = Object.fromEntries(formData);

    try {
      submitButton.disabled = true;
      submitButton.textContent = 'Отправляем...';

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Ошибка отправки заявки');
      }

      closeQuickOrder();
      form.reset();

      showToast(
        'Заявка отправлена',
        'Наш менеджер скоро свяжется с вами',
        'success',
      );
    } catch (error) {
      showToast(
        'Заявка не отправлена',
        'Попробуйте еще раз позже',
        'error',
      );
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Отправить заявку';
    }
  });
