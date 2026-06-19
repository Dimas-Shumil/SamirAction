const header = document.querySelector('.header');
const burger = document.querySelector('.header__burger');

let lastScrollY = window.scrollY;
let currentProduct = null;
let selectedSize = null;
let quickOrderProduct = null;
let quickOrderSize = null;

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

// =========================
// helpers
// =========================

function formatPrice(price) {
  return `${Number(price).toLocaleString('ru-RU')} ₽`;
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch (error) {
    localStorage.removeItem('cart');
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartCounter() {
  const cart = getCart();

  const totalQuantity = cart.reduce((total, item) => {
    return total + Number(item.quantity || 0);
  }, 0);

  document.querySelectorAll('.header__cart b').forEach((counter) => {
    counter.textContent = totalQuantity;
  });

  document.querySelectorAll('.header__mobile-nav a span').forEach((counter) => {
    counter.textContent = totalQuantity;
  });
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

function addToCart(productId, size = null, quantity = 1) {
  const cart = getCart();
  const normalizedQuantity = Math.max(Number(quantity) || 1, 1);

  const existingItem = cart.find((item) => {
    return item.id === productId && (item.size || null) === (size || null);
  });

  if (existingItem) {
    existingItem.quantity += normalizedQuantity;
  } else {
    cart.push({
      id: productId,
      size,
      quantity: normalizedQuantity,
    });
  }

  saveCart(cart);
  updateCartCounter();

  showToast(
    'Товар добавлен',
    normalizedQuantity > 1
      ? `В корзину добавлено ${normalizedQuantity} шт.`
      : 'Товар успешно добавлен в корзину',
    'success',
  );
}

function getSelectedQuantity() {
  const quantityElement = document.querySelector('#productQuantity');

  if (!quantityElement) return 1;

  return Math.max(Number(quantityElement.textContent) || 1, 1);
}

// =========================
// modal
// =========================

function ensureQuickOrderModal() {
  const existingModal = document.querySelector('#quickOrderModal');

  if (existingModal) return existingModal;

  const modal = document.createElement('div');

  modal.innerHTML = `
    <div class="quick-modal" id="quickOrderModal" aria-hidden="true">
      <div class="quick-modal__overlay" data-quick-close></div>

      <div class="quick-modal__dialog" role="dialog" aria-modal="true">
        <button class="quick-modal__close" type="button" data-quick-close>
          ×
        </button>

        <p class="quick-modal__label">Быстрый заказ</p>

        <h2 class="quick-modal__title">Оставьте контакты</h2>

        <p class="quick-modal__text">
          Мы свяжемся с вами, уточним размер, наличие и доставку.
        </p>

        <div class="quick-modal__product" id="quickOrderProduct"></div>

        <form class="quick-modal__form" id="quickOrderForm">
          <input type="hidden" name="productId" id="quickProductId" />
          <input type="hidden" name="size" id="quickProductSize" />
          <input type="hidden" name="type" value="quick" />

          <!-- Honeypot: человек не видит, бот может заполнить -->
          <input
            class="quick-modal__hidden"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />

          <!-- Время открытия формы для антиспам-проверки -->
          <input type="hidden" name="formStartedAt" id="quickFormStartedAt" />

          <label>
            <span>Ваше имя</span>

            <input
              type="text"
              name="name"
              placeholder="Например, Павел"
              autocomplete="name"
              minlength="2"
              maxlength="80"
              required
            />
          </label>

          <label>
            <span>Телефон</span>

            <input
              type="tel"
              name="phone"
              placeholder="+7 ___ ___-__-__"
              autocomplete="tel"
              minlength="6"
              maxlength="40"
              required
            />
          </label>

          <label class="quick-modal__agreement">
            <input
              type="checkbox"
              name="privacyAccepted"
              value="yes"
              required
            />

            <span>
              Я соглашаюсь с
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                политикой конфиденциальности </a
              >, даю согласие на
              <a
                href="/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                обработку персональных данных
              </a>
              и подтверждаю, что ознакомлен с
              <a href="/offer" target="_blank" rel="noopener noreferrer">
                публичной офертой </a
              >.
            </span>
          </label>

          <button type="submit">Отправить заявку</button>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal.firstElementChild);

  return document.querySelector('#quickOrderModal');
}

function openQuickOrder(product, size = null) {
  const modal = ensureQuickOrderModal();
  const productBox = document.querySelector('#quickOrderProduct');
  const productIdInput = document.querySelector('#quickProductId');
  const productSizeInput = document.querySelector('#quickProductSize');
  const quantity = getSelectedQuantity();

  if (!modal || !productBox || !productIdInput || !productSizeInput) return;

  quickOrderProduct = product;
  quickOrderSize = size || null;

  productIdInput.value = product.id;
  productSizeInput.value = size || '';

  productBox.innerHTML = `
    <img src="${product.images?.[0] || ''}" alt="${product.title}" />

    <div>
      <strong>${product.title}</strong>
      <span>
        ${formatPrice(product.price)}
        ${size ? ` · ${size}` : ''}
        ${quantity > 1 ? ` · ${quantity} шт.` : ''}
      </span>
    </div>
  `;

  setQuickFormStartedAt();
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

  quickOrderProduct = null;
  quickOrderSize = null;
}

function setQuickFormStartedAt() {
  const startedAtInput = document.querySelector('#quickFormStartedAt');

  if (startedAtInput) {
    startedAtInput.value = String(Date.now());
  }
}

// =========================
// render product
// =========================

function renderProduct(product) {
  const container = document.querySelector('#productPage');
  const breadcrumb = document.querySelector('#productBreadcrumb');

  if (!container) return;

  currentProduct = product;
  selectedSize = product.sizes?.[0] || null;

  document.title = product.seoTitle || `${product.title} — SAMIR WRESTLING`;

  if (breadcrumb) {
    breadcrumb.textContent = product.title;
  }

  const productImages = product.images?.length
    ? product.images
    : ['/site/images/products/tshort.png'];

  container.innerHTML = `
    <div class="product-gallery">
      ${
        product.badge
          ? `<span class="product-gallery__badge">${product.badge}</span>`
          : ''
      }

      <div class="product-gallery__main">

        <img
          id="productMainImage"
          src="${productImages[0]}"
          alt="${product.title}"
        />
      </div>

      <div class="product-gallery__carousel">
        <button
          class="product-gallery__arrow"
          type="button"
          data-gallery-arrow="prev"
          aria-label="Предыдущее фото"
        >
          ‹
        </button>

        <div class="product-gallery__thumbs" id="productThumbs">
          ${productImages
            .map(
              (image, index) => `
                <button
                  class="product-gallery__thumb ${index === 0 ? 'active' : ''}"
                  type="button"
                  data-image="${image}"
                  data-index="${index}"
                  aria-label="Фото товара ${index + 1}"
                >
                  <img src="${image}" alt="${product.title}" />
                </button>
              `,
            )
            .join('')}
        </div>

        <button
          class="product-gallery__arrow"
          type="button"
          data-gallery-arrow="next"
          aria-label="Следующее фото"
        >
          ›
        </button>
      </div>
    </div>

    <div class="product-info">
      <h1>${product.title}</h1>

      ${
        product.badge
          ? `<span class="product-info__badge">${product.badge}</span>`
          : ''
      }

      <div class="product-info__prices">
        <strong>${formatPrice(product.price)}</strong>

        ${
          product.oldPrice
            ? `<span>${formatPrice(product.oldPrice)}</span>`
            : ''
        }
      </div>

      <p class="product-info__description">
        ${product.shortDescription || product.description || ''}
      </p>

      <div class="product-info__status">
        <span>${product.available ? 'В наличии' : 'Нет в наличии'}</span>
        <b></b>
        <p>Артикул: ${product.sku || '—'}</p>
      </div>

      ${
        product.sizes?.length
          ? `
            <div class="product-info__sizes">
              <p>Размер</p>

              <div>
                ${product.sizes
                  .map(
                    (size, index) => `
                      <button
                        class="product-info__size ${index === 0 ? 'active' : ''}"
                        type="button"
                        data-size="${size}"
                      >
                        ${size}
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `
          : ''
      }

      <div class="product-info__quantity">
        <p>Количество</p>

        <div>
          <button type="button" data-quantity="minus" aria-label="Уменьшить количество">
            −
          </button>

          <span id="productQuantity">1</span>

          <button type="button" data-quantity="plus" aria-label="Увеличить количество">
            +
          </button>
        </div>
      </div>

      <div class="product-info__actions">
        <button
          class="product-info__button product-info__button--cart"
          type="button"
          id="productAddToCart"
        >
          В корзину
        </button>

        <button
          class="product-info__button product-info__button--quick"
          type="button"
        >
          Быстрый заказ
        </button>
      </div>

      <div class="product-info__features">
        <div>
          <span>
            <img
              src="/site/icons/benefits/benefir-truck.png"
              alt=""
            />
          </span>

          <p>
            <strong>Доставка по России</strong>
            Быстрая доставка по всей России
          </p>
        </div>

        <div>
          <span>
            <img
              src="/site/icons/benefits/benefit-manager.png"
              alt=""
            />
          </span>

          <p>
            <strong>Возврат и обмен</strong>
            Возврат в течение 14 дней без лишних вопросов
          </p>
        </div>

        <div>
          <span>
            <img
              src="/site/icons/benefits/benefit-setka.png"
              alt=""
            />
          </span>

          <p>
            <strong>Безопасная оплата</strong>
            Ваши данные защищены. Мы не храним данные карт
          </p>
        </div>
      </div>
    </div>
  `;
}

async function loadProductPage() {
  const slug = window.location.pathname.split('/').pop();
  const container = document.querySelector('#productPage');

  try {
    const response = await fetch(`/api/products/${slug}`);
    const product = await response.json();

    if (!response.ok) {
      throw new Error(product.message || 'Товар не найден');
    }

    renderProduct(product);
  } catch (error) {
    console.error('Product loading error:', error);

    if (container) {
      container.innerHTML = `
        <div class="product-page__error">
          <h1>Товар не найден</h1>
          <p>Возможно, ссылка устарела или товар был снят с продажи.</p>
          <a href="/catalog">Вернуться в каталог</a>
        </div>
      `;
    }
  }
}

// =========================
// events
// =========================

document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-quick-close]');
  const thumb = event.target.closest('.product-gallery__thumb');
  const sizeButton = event.target.closest('.product-info__size');
  const quickButton = event.target.closest('.product-info__button--quick');
  const addButton = event.target.closest('#productAddToCart');
  const galleryArrow = event.target.closest('[data-gallery-arrow]');
  const quantityButton = event.target.closest('[data-quantity]');

  if (closeButton) {
    closeQuickOrder();
    return;
  }

  if (galleryArrow) {
    const thumbs = [...document.querySelectorAll('.product-gallery__thumb')];

    if (!thumbs.length) return;

    const activeIndex = thumbs.findIndex((item) => {
      return item.classList.contains('active');
    });

    const direction = galleryArrow.dataset.galleryArrow;
    let nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;

    if (nextIndex > thumbs.length - 1) nextIndex = 0;
    if (nextIndex < 0) nextIndex = thumbs.length - 1;

    thumbs[nextIndex].click();

    return;
  }

  if (quantityButton) {
    const quantityElement = document.querySelector('#productQuantity');

    if (!quantityElement) return;

    let quantity = Number(quantityElement.textContent) || 1;

    if (quantityButton.dataset.quantity === 'plus') {
      quantity += 1;
    }

    if (quantityButton.dataset.quantity === 'minus') {
      quantity = Math.max(quantity - 1, 1);
    }

    quantityElement.textContent = quantity;

    return;
  }

  if (thumb) {
    const mainImage = document.querySelector('#productMainImage');

    document.querySelectorAll('.product-gallery__thumb').forEach((button) => {
      button.classList.remove('active');
    });

    thumb.classList.add('active');

    if (mainImage) {
      mainImage.src = thumb.dataset.image;
    }

    return;
  }

  if (sizeButton) {
    document.querySelectorAll('.product-info__size').forEach((button) => {
      button.classList.remove('active');
    });

    sizeButton.classList.add('active');
    selectedSize = sizeButton.dataset.size;

    return;
  }

  if (quickButton && currentProduct) {
    openQuickOrder(currentProduct, selectedSize);
    return;
  }

  if (addButton && currentProduct) {
    const quantity = getSelectedQuantity();

    addToCart(currentProduct.id, selectedSize, quantity);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeQuickOrder();
  }
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('#quickOrderForm');

  if (!form) return;

  event.preventDefault();

  const submitButton = form.querySelector('button[type="submit"]');
  const formData = new FormData(form);
  const orderData = Object.fromEntries(formData);

  if (quickOrderProduct) {
    const quantity = getSelectedQuantity();

    orderData.type = 'quick';
    orderData.productId = quickOrderProduct.id;
    orderData.size = quickOrderSize || null;
    orderData.items = [
      {
        id: quickOrderProduct.id,
        title: quickOrderProduct.title,
        size: quickOrderSize || null,
        quantity,
        price: quickOrderProduct.price,
        total: quickOrderProduct.price * quantity,
      },
    ];
    orderData.total = quickOrderProduct.price * quantity;
  }

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
    console.error('Quick order error:', error);

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

updateCartCounter();
loadProductPage();
