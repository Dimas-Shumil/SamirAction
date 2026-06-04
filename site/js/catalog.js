const header = document.querySelector('.header');
const burger = document.querySelector('.header__burger');

let lastScrollY = window.scrollY;
let allProducts = [];
let currentCategory = 'all';
let currentSize = null;
let currentSort = 'popular';

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

function addToCart(productId, size = null) {
  const cart = getCart();

  const existingItem = cart.find((item) => {
    return item.id === productId && (item.size || null) === (size || null);
  });

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

async function getProducts() {
  if (allProducts.length) return allProducts;

  const response = await fetch('/api/products');

  if (!response.ok) {
    throw new Error('Не удалось загрузить товары');
  }

  allProducts = await response.json();

  return allProducts;
}

function getSelectedFilters() {
  const search = document.querySelector('#catalogSearch')?.value || '';
  const availableOnly = document.querySelector('#catalogAvailable')?.checked ?? true;

  return {
    search: search.trim().toLowerCase(),
    availableOnly,
  };
}

function filterProducts(products) {
  const { search, availableOnly } = getSelectedFilters();

  return products.filter((product) => {
    const categoryMatch =
      currentCategory === 'all' || product.category === currentCategory;

    const sizeMatch =
      !currentSize || product.sizes?.includes(currentSize);

    const availableMatch = !availableOnly || product.available;

    const searchMatch =
      !search ||
      product.title.toLowerCase().includes(search) ||
      product.categoryTitle.toLowerCase().includes(search);

    return categoryMatch && sizeMatch && availableMatch && searchMatch;
  });
}

function sortProducts(products) {
  const sortedProducts = [...products];

  if (currentSort === 'price-asc') {
    sortedProducts.sort((a, b) => a.price - b.price);
  }

  if (currentSort === 'price-desc') {
    sortedProducts.sort((a, b) => b.price - a.price);
  }

  if (currentSort === 'new') {
    sortedProducts.sort((a, b) => {
      const aNew = a.badge === 'Новинка' ? 1 : 0;
      const bNew = b.badge === 'Новинка' ? 1 : 0;

      return bNew - aNew;
    });
  }

  if (currentSort === 'popular') {
    sortedProducts.sort((a, b) => {
      const aPopular = a.isPopular ? 1 : 0;
      const bPopular = b.isPopular ? 1 : 0;

      return bPopular - aPopular;
    });
  }

  return sortedProducts;
}

function renderProducts(products) {
  const container = document.querySelector('#catalogProducts');
  const count = document.querySelector('#catalogCount');
  const empty = document.querySelector('#catalogEmpty');

  if (!container) return;

  if (count) {
    count.textContent = `Показано ${products.length} ${getProductWord(products.length)}`;
  }

  if (!products.length) {
    container.innerHTML = '';
    empty?.removeAttribute('hidden');
    return;
  }

  empty?.setAttribute('hidden', true);

  container.innerHTML = products
    .map(
      (product) => `
        <article class="product-card">
          ${
            product.badge
              ? `<div class="product-card__badge">${product.badge}</div>`
              : ''
          }

          <a href="/product/${product.slug}" class="product-card__image">
            <img
              src="${product.images?.[0] || '/site/images/products/tshort.png'}"
              alt="${product.title}"
              loading="lazy"
            />
          </a>

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
                  ? `<span>${formatPrice(product.oldPrice)}</span>`
                  : ''
              }

              <strong>${formatPrice(product.price)}</strong>
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

function getProductWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'товаров';
  }

  if (lastDigit === 1) {
    return 'товар';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'товара';
  }

  return 'товаров';
}

async function renderCatalog() {
  try {
    const products = await getProducts();

    const filteredProducts = filterProducts(products);
    const sortedProducts = sortProducts(filteredProducts);

    renderProducts(sortedProducts);
  } catch (error) {
    console.error('Catalog render error:', error);

    showToast(
      'Ошибка загрузки',
      'Не удалось загрузить товары каталога',
      'error',
    );
  }
}

function syncCategoryControls(category) {
  document.querySelectorAll('.catalog-tabs__button').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === category);
  });

  document.querySelectorAll('input[name="category"]').forEach((input) => {
    input.checked = input.value === category;
  });
}

function resetCatalogFilters() {
  currentCategory = 'all';
  currentSize = null;
  currentSort = 'popular';

  const search = document.querySelector('#catalogSearch');
  const available = document.querySelector('#catalogAvailable');

  if (search) search.value = '';
  if (available) available.checked = true;

  syncCategoryControls('all');

  document.querySelectorAll('#catalogSizes button').forEach((button) => {
    button.classList.remove('active');
  });

  document.querySelectorAll('.catalog-sort__button').forEach((button) => {
    button.classList.toggle('active', button.dataset.sort === 'popular');
  });

  renderCatalog();
}

async function openQuickOrder(productId, size = null) {
  const modal = document.querySelector('#quickOrderModal');
  const productBox = document.querySelector('#quickOrderProduct');
  const productIdInput = document.querySelector('#quickProductId');
  const productSizeInput = document.querySelector('#quickProductSize');

  if (!modal || !productBox || !productIdInput || !productSizeInput) return;

  const products = await getProducts();
  const product = products.find((item) => item.id === productId);

  if (!product) {
    showToast('Товар не найден', 'Попробуйте обновить страницу', 'error');
    return;
  }

  productIdInput.value = product.id;
  productSizeInput.value = size || '';

  productBox.innerHTML = `
    <img src="${product.images?.[0] || ''}" alt="${product.title}" />

    <div>
      <strong>${product.title}</strong>
      <span>${formatPrice(product.price)}${size ? ` · ${size}` : ''}</span>
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
}

function setQuickFormStartedAt() {
  const startedAtInput = document.querySelector('#quickFormStartedAt');

  if (startedAtInput) {
    startedAtInput.value = String(Date.now());
  }
}

document.addEventListener('click', async (event) => {
  const tabButton = event.target.closest('.catalog-tabs__button');
  const sizeFilterButton = event.target.closest('#catalogSizes button');
  const sortButton = event.target.closest('.catalog-sort__button');
  const resetButton = event.target.closest('#catalogReset, #catalogEmptyReset');
  const productSizeButton = event.target.closest('.product-card__size');
  const cartButton = event.target.closest('.product-card__button--cart');
  const quickButton = event.target.closest('.product-card__button--quick');
  const closeButton = event.target.closest('[data-quick-close]');

  if (closeButton) {
    closeQuickOrder();
    return;
  }

  if (tabButton) {
    currentCategory = tabButton.dataset.category || 'all';
    syncCategoryControls(currentCategory);
    renderCatalog();
    return;
  }

  if (sizeFilterButton) {
    const size = sizeFilterButton.dataset.size;

    if (currentSize === size) {
      currentSize = null;
      sizeFilterButton.classList.remove('active');
    } else {
      currentSize = size;

      document.querySelectorAll('#catalogSizes button').forEach((button) => {
        button.classList.remove('active');
      });

      sizeFilterButton.classList.add('active');
    }

    renderCatalog();
    return;
  }

  if (sortButton) {
    currentSort = sortButton.dataset.sort || 'popular';

    document.querySelectorAll('.catalog-sort__button').forEach((button) => {
      button.classList.remove('active');
    });

    sortButton.classList.add('active');

    renderCatalog();
    return;
  }

  if (resetButton) {
    resetCatalogFilters();
    return;
  }

  if (productSizeButton) {
    const sizesWrapper = productSizeButton.closest('.product-card__sizes');

    sizesWrapper?.querySelectorAll('.product-card__size').forEach((button) => {
      button.classList.remove('active');
    });

    productSizeButton.classList.add('active');
    return;
  }

  if (cartButton) {
    const productId = cartButton.dataset.productId;
    const card = cartButton.closest('.product-card');
    const activeSize = card?.querySelector('.product-card__size.active');
    const size = activeSize?.dataset.size || null;

    addToCart(productId, size);
    return;
  }

  if (quickButton) {
    const productId = quickButton.dataset.productId;
    const card = quickButton.closest('.product-card');
    const activeSize = card?.querySelector('.product-card__size.active');
    const size = activeSize?.dataset.size || null;

    await openQuickOrder(productId, size);
  }
});

document.addEventListener('change', (event) => {
  const categoryInput = event.target.closest('input[name="category"]');
  const availableInput = event.target.closest('#catalogAvailable');

  if (categoryInput) {
    currentCategory = categoryInput.value;
    syncCategoryControls(currentCategory);
    renderCatalog();
    return;
  }

  if (availableInput) {
    renderCatalog();
  }
});

document.querySelector('#catalogSearch')?.addEventListener('input', () => {
  renderCatalog();
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
renderCatalog();
