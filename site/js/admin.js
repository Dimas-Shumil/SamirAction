const Admin = (() => {
  let csrfToken = '';

  const statusLabels = {
    published: 'Опубликован',
    pending: 'На проверке',
    hidden: 'Скрыт',
  };

  async function request(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
    };

    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (options.csrf) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || 'Ошибка запроса');
    }

    return result;
  }

  async function checkAuth() {
    await request('/api/admin/check');
  }

  async function loadCsrfToken() {
    const result = await request('/api/admin/csrf');
    csrfToken = result.csrfToken || '';
  }

  async function logout() {
    await request('/api/admin/logout', {
      method: 'POST',
      csrf: true,
    });

    window.location.href = '/admin/login.html';
  }

  function initLogout() {
    document.querySelectorAll('[data-admin-logout]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await logout();
        } catch (error) {
          alert(error.message || 'Не удалось выйти');
        }
      });
    });
  }

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (symbol) => {
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

  function getMainImage(product) {
    if (Array.isArray(product.images) && product.images.length) {
      return product.images[0];
    }

    return '/site/images/logo.png';
  }

  function getProductStatus(product) {
    return product.adminStatus || 'published';
  }

  function renderProductRow(product) {
    const status = getProductStatus(product);
    const image = getMainImage(product);
    const sizes =
      Array.isArray(product.sizes) && product.sizes.length
        ? product.sizes.join(', ')
        : '—';

    return `
      <tr>
        <td>
          <div class="admin-product-cell">
            <img
              class="admin-product-cell__image"
              src="${escapeHtml(image)}"
              alt=""
              loading="lazy"
            />

            <div>
              <div class="admin-product-cell__title">
                ${escapeHtml(product.title)}
              </div>

              <div class="admin-product-cell__meta">
                ${escapeHtml(product.slug)}
              </div>

              <div class="admin-product-cell__meta">
                ${escapeHtml(product.sku || 'Без артикула')}
              </div>
            </div>
          </div>
        </td>

        <td>
          <div class="admin-table__strong">
            ${escapeHtml(product.categoryTitle || 'Товары')}
          </div>
          <div class="admin-table__muted">
            ${escapeHtml(product.category || 'products')}
          </div>
        </td>

        <td>
          <div class="admin-table__strong">
            ${formatMoney(product.price)}
          </div>
          ${
            product.oldPrice
              ? `<div class="admin-table__muted">${formatMoney(product.oldPrice)}</div>`
              : ''
          }
        </td>

        <td>
          <div class="admin-table__muted">
            ${escapeHtml(sizes)}
          </div>
        </td>

        <td>
          <span class="admin-status admin-status--${escapeHtml(status)}">
            ${escapeHtml(statusLabels[status] || 'Опубликован')}
          </span>

          ${
            product.publishAfter && status === 'pending'
              ? `<div class="admin-table__muted admin-table__date">до ${formatDate(product.publishAfter)}</div>`
              : ''
          }
        </td>

        <td>
          <div class="admin-actions">
            <a
              class="admin-action"
              href="/admin/product-edit.html?id=${encodeURIComponent(product.id)}"
            >
              Изменить
            </a>

            <button
              class="admin-action"
              type="button"
              data-product-visibility
              data-product-id="${escapeHtml(product.id)}"
              data-product-available="${product.available ? 'false' : 'true'}"
            >
              ${product.available ? 'Скрыть' : 'Показать'}
            </button>

            <button
              class="admin-action admin-action--danger"
              type="button"
              data-product-delete
              data-product-id="${escapeHtml(product.id)}"
            >
              Удалить
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function setProductsLoading(isLoading) {
    const loading = document.querySelector('[data-products-loading]');

    if (loading) {
      loading.hidden = !isLoading;
    }
  }

  function renderProducts(products) {
    const table = document.querySelector('[data-products-table]');
    const tableWrap = document.querySelector('[data-products-table-wrap]');
    const empty = document.querySelector('[data-products-empty]');
    const count = document.querySelector('[data-products-count]');

    if (count) {
      count.textContent = `${products.length} товаров в базе`;
    }

    if (!products.length) {
      if (tableWrap) tableWrap.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    if (tableWrap) tableWrap.hidden = false;

    if (table) {
      table.innerHTML = products.map(renderProductRow).join('');
    }

    initProductActions();
  }

  async function loadProducts() {
    setProductsLoading(true);

    try {
      const products = await request('/api/admin/products');
      renderProducts(products);
    } catch (error) {
      const count = document.querySelector('[data-products-count]');

      if (count) {
        count.textContent = error.message || 'Не удалось загрузить товары';
      }
    } finally {
      setProductsLoading(false);
    }
  }

  async function toggleProductVisibility(button) {
    const productId = button.dataset.productId;
    const available = button.dataset.productAvailable === 'true';

    if (!productId) return;

    button.disabled = true;

    try {
      await request(
        `/api/admin/products/${encodeURIComponent(productId)}/visibility`,
        {
          method: 'PATCH',
          csrf: true,
          body: JSON.stringify({ available }),
        },
      );

      await loadProducts();
    } catch (error) {
      alert(error.message || 'Не удалось изменить видимость товара');
    } finally {
      button.disabled = false;
    }
  }

  async function deleteProduct(button) {
    const productId = button.dataset.productId;

    if (!productId) return;

    const isConfirmed = window.confirm(
      'Удалить товар? Это действие нельзя отменить.',
    );

    if (!isConfirmed) return;

    button.disabled = true;

    try {
      await request(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        csrf: true,
      });

      await loadProducts();
    } catch (error) {
      alert(error.message || 'Не удалось удалить товар');
    } finally {
      button.disabled = false;
    }
  }

  function initProductActions() {
    document.querySelectorAll('[data-product-visibility]').forEach((button) => {
      button.addEventListener('click', () => toggleProductVisibility(button));
    });

    document.querySelectorAll('[data-product-delete]').forEach((button) => {
      button.addEventListener('click', () => deleteProduct(button));
    });
  }

  function initProductsPage() {
    if (!document.querySelector('[data-products-page]')) return;

    loadProducts();
  }

  function getEditProductId() {
    const params = new URLSearchParams(window.location.search);

    return params.get('id');
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/ё/g, 'e')
      .replace(/й/g, 'y')
      .replace(/ц/g, 'ts')
      .replace(/у/g, 'u')
      .replace(/к/g, 'k')
      .replace(/е/g, 'e')
      .replace(/н/g, 'n')
      .replace(/г/g, 'g')
      .replace(/ш/g, 'sh')
      .replace(/щ/g, 'sch')
      .replace(/з/g, 'z')
      .replace(/х/g, 'h')
      .replace(/ъ/g, '')
      .replace(/ф/g, 'f')
      .replace(/ы/g, 'y')
      .replace(/в/g, 'v')
      .replace(/а/g, 'a')
      .replace(/п/g, 'p')
      .replace(/р/g, 'r')
      .replace(/о/g, 'o')
      .replace(/л/g, 'l')
      .replace(/д/g, 'd')
      .replace(/ж/g, 'zh')
      .replace(/э/g, 'e')
      .replace(/я/g, 'ya')
      .replace(/ч/g, 'ch')
      .replace(/с/g, 's')
      .replace(/м/g, 'm')
      .replace(/и/g, 'i')
      .replace(/т/g, 't')
      .replace(/ь/g, '')
      .replace(/б/g, 'b')
      .replace(/ю/g, 'yu')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function splitList(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getFormPayload(form) {
    const formData = new FormData(form);

    return {
      title: String(formData.get('title') || '').trim(),
      slug: String(formData.get('slug') || '').trim(),
      category: String(formData.get('category') || '').trim(),
      categoryTitle: String(formData.get('categoryTitle') || '').trim(),

      price: Number(formData.get('price') || 0),
      oldPrice: formData.get('oldPrice')
        ? Number(formData.get('oldPrice'))
        : null,

      badge: String(formData.get('badge') || '').trim(),
      sku: String(formData.get('sku') || '').trim(),

      isPopular: formData.get('isPopular') === 'on',
      available: formData.get('available') === 'on',

      images: splitList(formData.get('images')),
      sizes: splitList(formData.get('sizes')),

      color: String(formData.get('color') || '').trim(),
      bundle: String(formData.get('bundle') || '').trim(),
      material: String(formData.get('material') || '').trim(),

      shortDescription: String(formData.get('shortDescription') || '').trim(),
      description: String(formData.get('description') || '').trim(),

      seoTitle: String(formData.get('seoTitle') || '').trim(),
      seoDescription: String(formData.get('seoDescription') || '').trim(),

      sortOrder: Number(formData.get('sortOrder') || 100),
    };
  }

  function setProductFormMessage(text, type = 'error') {
    const message = document.querySelector('[data-product-form-message]');

    if (!message) return;

    message.textContent = text;
    message.className = `admin-message admin-message--${type}`;
  }

  function renderImagesPreview() {
    const form = document.querySelector('#productForm');
    const preview = document.querySelector('[data-product-images-preview]');

    if (!form || !preview) return;

    const images = splitList(form.elements.images.value);

    if (!images.length) {
      preview.innerHTML =
        '<div class="admin-empty">Фото пока не добавлены.</div>';
      return;
    }

    preview.innerHTML = images
      .map((image, index) => {
        return `
          <div class="admin-image-item">
            <img src="${escapeHtml(image)}" alt="" loading="lazy" />
            <button
              type="button"
              data-remove-product-image="${index}"
              aria-label="Удалить фото"
            >
              ×
            </button>
          </div>
        `;
      })
      .join('');

    preview
      .querySelectorAll('[data-remove-product-image]')
      .forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(button.dataset.removeProductImage);
          const nextImages = images.filter(
            (_, imageIndex) => imageIndex !== index,
          );

          form.elements.images.value = nextImages.join(', ');
          renderImagesPreview();
        });
      });
  }

  function fillProductForm(product) {
    const form = document.querySelector('#productForm');

    if (!form) return;

    form.elements.title.value = product.title || '';
    form.elements.slug.value = product.slug || '';
    form.elements.category.value = product.category || '';
    form.elements.categoryTitle.value = product.categoryTitle || '';

    form.elements.price.value = product.price || '';
    form.elements.oldPrice.value = product.oldPrice || '';

    form.elements.badge.value = product.badge || '';
    form.elements.sku.value = product.sku || '';

    form.elements.isPopular.checked = Boolean(product.isPopular);
    form.elements.available.checked = product.available !== false;

    form.elements.images.value = Array.isArray(product.images)
      ? product.images.join(', ')
      : '';

    form.elements.sizes.value = Array.isArray(product.sizes)
      ? product.sizes.join(', ')
      : '';

    form.elements.color.value = product.color || '';
    form.elements.bundle.value = product.bundle || '';
    form.elements.material.value = product.material || '';

    form.elements.shortDescription.value = product.shortDescription || '';
    form.elements.description.value = product.description || '';

    form.elements.seoTitle.value = product.seoTitle || '';
    form.elements.seoDescription.value = product.seoDescription || '';

    form.elements.sortOrder.value = product.sortOrder || 100;

    renderImagesPreview();
  }

  async function uploadProductImages(files) {
    const uploadedUrls = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);

      const result = await request('/api/admin/uploads/product-image', {
        method: 'POST',
        csrf: true,
        body: formData,
      });

      if (result.url) {
        uploadedUrls.push(result.url);
      }
    }

    return uploadedUrls;
  }

  function initProductImageUpload() {
    const input = document.querySelector('[data-product-images-input]');
    const form = document.querySelector('#productForm');

    if (!input || !form) return;

    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);

      if (!files.length) return;

      input.disabled = true;
      setProductFormMessage('Загружаем фото...', 'info');

      try {
        const uploadedUrls = await uploadProductImages(files);
        const currentImages = splitList(form.elements.images.value);
        const nextImages = [...currentImages, ...uploadedUrls];

        form.elements.images.value = nextImages.join(', ');
        renderImagesPreview();

        setProductFormMessage('Фото загружены', 'success');
      } catch (error) {
        setProductFormMessage(error.message || 'Не удалось загрузить фото');
      } finally {
        input.disabled = false;
        input.value = '';
      }
    });
  }

  function initSlugAutofill() {
    const form = document.querySelector('#productForm');

    if (!form) return;

    const titleInput = form.elements.title;
    const slugInput = form.elements.slug;

    let slugTouched = Boolean(slugInput.value);

    slugInput.addEventListener('input', () => {
      slugTouched = true;
    });

    titleInput.addEventListener('input', () => {
      if (slugTouched) return;

      slugInput.value = slugify(titleInput.value);
    });
  }

  async function loadProductForEdit(productId) {
    const title = document.querySelector('[data-product-edit-title]');

    if (title) {
      title.textContent = 'Редактирование товара';
    }

    const product = await request(
      `/api/admin/products/${encodeURIComponent(productId)}`,
    );
    fillProductForm(product);
  }

  async function saveProduct(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const productId = getEditProductId();
    const submitButton = form.querySelector('button[type="submit"]');
    const payload = getFormPayload(form);

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Сохраняем...';
      }

      setProductFormMessage('', 'info');

      const url = productId
        ? `/api/admin/products/${encodeURIComponent(productId)}`
        : '/api/admin/products';

      const method = productId ? 'PATCH' : 'POST';

      const result = await request(url, {
        method,
        csrf: true,
        body: JSON.stringify(payload),
      });

      setProductFormMessage(result.message || 'Товар сохранен', 'success');

      setTimeout(() => {
        window.location.href = '/admin/products.html';
      }, 700);
    } catch (error) {
      setProductFormMessage(error.message || 'Не удалось сохранить товар');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Сохранить товар';
      }
    }
  }

  async function initProductEditPage() {
    if (!document.querySelector('[data-product-edit-page]')) return;

    const form = document.querySelector('#productForm');

    if (!form) return;

    initSlugAutofill();
    initProductImageUpload();
    renderImagesPreview();

    const productId = getEditProductId();

    try {
      if (productId) {
        await loadProductForEdit(productId);
      }

      form.addEventListener('submit', saveProduct);
    } catch (error) {
      setProductFormMessage(error.message || 'Не удалось загрузить товар');
    }
  }

  const orderStatusLabels = {
    new: 'Новая',
    in_work: 'В работе',
    completed: 'Выполнена',
    cancelled: 'Отменена',
  };

  function renderOrderItems(order) {
    if (!Array.isArray(order.items) || !order.items.length) {
      return '<div class="admin-table__muted">Без выбранного товара</div>';
    }

    return order.items
      .map((item) => {
        return `
          <div class="admin-order-item">
            <div class="admin-order-item__title">
              ${escapeHtml(item.title || item.id || 'Товар')}
            </div>

            <div class="admin-order-item__meta">
              Размер: ${escapeHtml(item.size || '—')} · Кол-во: ${escapeHtml(item.quantity || 1)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  function renderOrderRow(order) {
    const status = order.status || 'new';

    return `
      <tr>
        <td>
          <div class="admin-table__strong">
            ${escapeHtml(order.name || 'Без имени')}
          </div>

          <div class="admin-table__muted">
            ${escapeHtml(order.phone || '—')}
          </div>

          <div class="admin-table__muted">
            № ${escapeHtml(order.id)}
          </div>
        </td>

        <td>
          ${renderOrderItems(order)}
        </td>

        <td>
          <div class="admin-table__strong">
            ${formatMoney(order.total)}
          </div>

          <div class="admin-table__muted">
            ${order.type === 'cart' ? 'Корзина' : 'Быстрый заказ'}
          </div>
        </td>

        <td>
          <div class="admin-table__muted">
            ${formatDate(order.createdAt)}
          </div>
        </td>

        <td>
          <select
            class="admin-status-select admin-status-select--${escapeHtml(status)}"
            data-order-status
            data-order-id="${escapeHtml(order.id)}"
          >
            <option value="new" ${status === 'new' ? 'selected' : ''}>Новая</option>
            <option value="in_work" ${status === 'in_work' ? 'selected' : ''}>В работе</option>
            <option value="completed" ${status === 'completed' ? 'selected' : ''}>Выполнена</option>
            <option value="cancelled" ${status === 'cancelled' ? 'selected' : ''}>Отменена</option>
          </select>
        </td>
      </tr>
    `;
  }

  function setOrdersLoading(isLoading) {
    const loading = document.querySelector('[data-orders-loading]');

    if (loading) {
      loading.hidden = !isLoading;
    }
  }

  function renderOrders(orders) {
    const table = document.querySelector('[data-orders-table]');
    const tableWrap = document.querySelector('[data-orders-table-wrap]');
    const empty = document.querySelector('[data-orders-empty]');
    const count = document.querySelector('[data-orders-count]');

    if (count) {
      count.textContent = `${orders.length} заявок в базе`;
    }

    if (!orders.length) {
      if (tableWrap) tableWrap.hidden = true;
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    if (tableWrap) tableWrap.hidden = false;

    if (table) {
      table.innerHTML = orders.map(renderOrderRow).join('');
    }

    initOrderActions();
  }

  async function loadOrders() {
    setOrdersLoading(true);

    try {
      const orders = await request('/api/admin/orders');
      renderOrders(orders);
    } catch (error) {
      const count = document.querySelector('[data-orders-count]');

      if (count) {
        count.textContent = error.message || 'Не удалось загрузить заявки';
      }
    } finally {
      setOrdersLoading(false);
    }
  }

  async function updateOrderStatus(select) {
    const orderId = select.dataset.orderId;
    const status = select.value;

    if (!orderId) {
      return;
    }

    select.disabled = true;

    try {
      await request(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        csrf: true,
        body: JSON.stringify({
          status,
        }),
      });

      select.className = `admin-status-select admin-status-select--${status}`;
    } catch (error) {
      alert(error.message || 'Не удалось обновить статус заявки');
      await loadOrders();
    } finally {
      select.disabled = false;
    }
  }

  function initOrderActions() {
    document.querySelectorAll('[data-order-status]').forEach((select) => {
      select.addEventListener('change', () => updateOrderStatus(select));
    });
  }

  function initOrdersPage() {
    if (!document.querySelector('[data-orders-page]')) {
      return;
    }

    loadOrders();
  }

  async function init() {
    try {
      await checkAuth();
      await loadCsrfToken();
      initLogout();
      initProductsPage();
      initOrdersPage();
      await initProductEditPage();
    } catch {
      window.location.href = '/admin/login.html';
    }
  }

  return {
    init,
    request,
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Admin.init();
});
