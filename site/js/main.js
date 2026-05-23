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
