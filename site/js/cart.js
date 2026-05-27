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

// корзина

function getCart() {
  return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function updateCartCounter() {
  const cart = getCart();

  const totalQuantity = cart.reduce((total, item) => total + item.quantity, 0);

  document.querySelectorAll('.header__cart b').forEach((counter) => {
    counter.textContent = totalQuantity;
  });

  document.querySelectorAll('.header__mobile-nav a span').forEach((counter) => {
    counter.textContent = totalQuantity;
  });
}

function addToCart(productId, size = null) {
  const cart = getCart();

  const existingItem = cart.find(
    (item) => item.id === productId && item.size === size,
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: productId,
      size,
      quantity: 1,
    });
  }

  saveCart(cart);
  updateCartCounter();

  showToast('Товар добавлен', 'Товар успешно добавлен в корзину', 'success');
}

document.addEventListener('click', (event) => {
  const cartButton = event.target.closest('.product-card__button--cart');

  if (!cartButton) return;

  const productId = cartButton.dataset.productId;

  const card = cartButton.closest('.product-card');

  const activeSize = card?.querySelector('.product-card__size.active');

  const size = activeSize?.dataset.size || null;

  addToCart(productId, size);
});

updateCartCounter();

// модалка
// модалка быстрого заказа

let allProducts = [];
let orderMode = 'quick';

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

function resetQuickModal() {
  orderMode = 'quick';

  document.querySelector('#quickProductId').value = '';
  document.querySelector('#quickProductSize').value = '';

  document.querySelector('.quick-modal__label').textContent = 'Быстрый заказ';
  document.querySelector('.quick-modal__title').textContent =
    'Оставьте контакты';
  document.querySelector('.quick-modal__text').textContent =
    'Мы свяжемся с вами, уточним размер, наличие и доставку.';

  document.querySelector('#quickOrderProduct').innerHTML = `
    <div>
      <strong>Быстрый заказ</strong>
      <span>Менеджер поможет подобрать товар</span>
    </div>
  `;
}

async function openQuickOrder(productId = null, size = null) {
  const modal = document.querySelector('#quickOrderModal');
  const productBox = document.querySelector('#quickOrderProduct');
  const productIdInput = document.querySelector('#quickProductId');
  const productSizeInput = document.querySelector('#quickProductSize');

  if (!modal) return;
  resetQuickModal();

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
  const checkoutButton = event.target.closest('#cartCheckoutButton');
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
    return;
  }

  if (checkoutButton) {
    const cart = getCart();

    if (!cart.length) {
      showToast('Корзина пуста', 'Добавьте товары перед оформлением', 'error');
      return;
    }

    await openQuickOrder();

    orderMode = 'cart';

    document.querySelector('#quickProductId').value = '';
    document.querySelector('#quickProductSize').value = '';

    document.querySelector('.quick-modal__label').textContent =
      'Оформление заказа';

    document.querySelector('.quick-modal__title').textContent =
      'Контакты для заказа';

    document.querySelector('.quick-modal__text').textContent =
      'Оставьте контакты — менеджер подтвердит заказ и доставку.';

    document.querySelector('#quickOrderProduct').innerHTML = `
    <div>
      <strong>Заказ из корзины</strong>
      <span>Товары, размеры и количество будут отправлены менеджеру</span>
    </div>
  `;

    return;
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
    const cart = getCart();

    if (orderMode === 'cart') {
      const products = await getProducts();

      orderData.type = 'cart';
      orderData.items = cart.map((cartItem) => {
        const product = products.find((item) => item.id === cartItem.id);

        return {
          id: cartItem.id,
          title: product?.title || 'Товар не найден',
          size: cartItem.size,
          quantity: cartItem.quantity,
          price: product?.price || 0,
          total: (product?.price || 0) * cartItem.quantity,
        };
      });

      orderData.total = orderData.items.reduce(
        (sum, item) => sum + item.total,
        0,
      );
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

      if (orderData.type === 'cart') {
        saveCart([]);
        updateCartCounter();
        renderCartPage();
      }

      closeQuickOrder();
      form.reset();
      resetQuickModal();

      showToast(
        'Заявка отправлена',
        'Наш менеджер скоро свяжется с вами',
        'success',
      );
    } catch (error) {
      showToast('Заявка не отправлена', 'Попробуйте еще раз позже', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Отправить заявку';
    }
  });

// рендер товаров в корзине + цены

async function renderCartPage() {
  const cartItemsContainer = document.querySelector('#cartItems');

  if (!cartItemsContainer) return;

  const cart = getCart();

  const products = await getProducts();

  if (!cart.length) {
    document.querySelector('#cartEmpty')?.removeAttribute('hidden');

    cartItemsContainer.innerHTML = '';

    return;
  }

  document.querySelector('#cartEmpty')?.setAttribute('hidden', true);

  const cartProducts = cart.map((cartItem) => {
    const product = products.find((item) => item.id === cartItem.id);

    return {
      ...product,
      size: cartItem.size,
      quantity: cartItem.quantity,
    };
  });

  cartItemsContainer.innerHTML = cartProducts
    .map(
      (product) => `
        <article class="cart-item">
          <a href="/product/${product.slug}" class="cart-item__image">
            <img src="${product.images[0]}" alt="${product.title}" />
          </a>

          <div class="cart-item__content">
            <div class="cart-item__info">
              <h3>${product.title}</h3>

              <p>
                Цвет:
                <span>${product.color}</span>
              </p>

              ${
                product.size
                  ? `
                    <p>
                      Размер:
                      <span>${product.size}</span>
                    </p>
                  `
                  : ''
              }
            </div>

            <strong class="cart-item__price">
              ${product.price.toLocaleString('ru-RU')} ₽
            </strong>

            <div class="cart-item__quantity">
              <button
                type="button"
                class="cart-item__quantity-button"
                data-action="decrease"
                data-product-id="${product.id}"
                data-size="${product.size || ''}"
              >
                −
              </button>

              <span>${product.quantity}</span>

              <button
                type="button"
                class="cart-item__quantity-button"
                data-action="increase"
                data-product-id="${product.id}"
                data-size="${product.size || ''}"
              >
                +
              </button>
            </div>

            <strong class="cart-item__total">
              ${(product.price * product.quantity).toLocaleString('ru-RU')} ₽
            </strong>

            <button
              class="cart-item__remove"
              type="button"
              data-action="remove"
              data-product-id="${product.id}"
              data-size="${product.size || ''}"
            >
              ×
            </button>
          </div>
        </article>
      `,
    )
    .join('');

  updateCartSummary(cartProducts);
}

function updateCartSummary(products) {
  const total = products.reduce(
    (sum, product) => sum + product.price * product.quantity,
    0,
  );

  const quantity = products.reduce((sum, product) => sum + product.quantity, 0);

  document.querySelector('#cartSubtotal').textContent =
    `${total.toLocaleString('ru-RU')} ₽`;

  document.querySelector('#cartTotal').textContent =
    `${total.toLocaleString('ru-RU')} ₽`;

  document.querySelector('#cartItemsCount').textContent = quantity;

  document.querySelector('#summaryItemsCount').textContent = `(${quantity})`;
}

document.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');

  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const productId = actionButton.dataset.productId;
  const size = actionButton.dataset.size || null;

  let cart = getCart();

  const cartItem = cart.find(
    (item) => item.id === productId && (item.size || null) === size,
  );

  if (!cartItem) return;

  if (action === 'increase') {
    cartItem.quantity += 1;
  }

  if (action === 'decrease') {
    cartItem.quantity -= 1;

    if (cartItem.quantity <= 0) {
      cart = cart.filter(
        (item) => !(item.id === productId && (item.size || null) === size),
      );
    }
  }

  if (action === 'remove') {
    cart = cart.filter(
      (item) => !(item.id === productId && (item.size || null) === size),
    );
  }

  saveCart(cart);
  updateCartCounter();
  renderCartPage();
});

renderCartPage();
