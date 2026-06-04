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

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart')) || [];
  } catch (error) {
    localStorage.removeItem('cart');
    return [];
  }
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

function createFormMessage() {
  const existingMessage = document.querySelector('#contactsFormMessage');

  if (existingMessage) return existingMessage;

  const message = document.createElement('div');

  message.id = 'contactsFormMessage';
  message.style.marginTop = '16px';
  message.style.padding = '14px 16px';
  message.style.borderRadius = '14px';
  message.style.fontSize = '14px';
  message.style.fontWeight = '700';
  message.style.lineHeight = '1.4';
  message.style.display = 'none';

  const form = document.querySelector('#contactsForm');
  form?.appendChild(message);

  return message;
}

function showFormMessage(text, type = 'success') {
  const message = createFormMessage();

  if (!message) return;

  const isSuccess = type === 'success';

  message.textContent = text;
  message.style.display = 'block';
  message.style.color = isSuccess ? '#ffffff' : '#ffffff';
  message.style.border = isSuccess
    ? '1px solid rgba(0, 102, 255, 0.45)'
    : '1px solid rgba(255, 75, 75, 0.45)';
  message.style.background = isSuccess
    ? 'rgba(0, 102, 255, 0.16)'
    : 'rgba(255, 75, 75, 0.16)';
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function initContactsForm() {
  const form = document.querySelector('#contactsForm');
  const startedAtInput = document.querySelector('#contactFormStartedAt');

  if (!form) return;

  if (startedAtInput) {
    startedAtInput.value = String(Date.now());
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('button[type="submit"]');
    const submitButtonText = submitButton?.querySelector('span');

    const formData = new FormData(form);

    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: normalizePhone(formData.get('phone')),
      message: String(formData.get('message') || '').trim(),
      privacyAccepted: formData.get('privacyAccepted') === 'yes' ? 'yes' : '',
      website: String(formData.get('website') || '').trim(),
      formStartedAt: String(formData.get('formStartedAt') || ''),
    };

    if (payload.name.length < 2) {
      showFormMessage('Введите корректное имя.', 'error');
      return;
    }

    if (payload.phone.length < 10) {
      showFormMessage('Введите корректный номер телефона.', 'error');
      return;
    }

    if (payload.message.length < 5) {
      showFormMessage('Введите сообщение минимум из 5 символов.', 'error');
      return;
    }

    if (payload.privacyAccepted !== 'yes') {
      showFormMessage('Нужно согласиться с политикой конфиденциальности.', 'error');
      return;
    }

    try {
      if (submitButton) {
        submitButton.disabled = true;
      }

      if (submitButtonText) {
        submitButtonText.textContent = 'Отправляем...';
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Не удалось отправить сообщение');
      }

      form.reset();

      if (startedAtInput) {
        startedAtInput.value = String(Date.now());
      }

      showFormMessage(
        result.message || 'Сообщение отправлено. Мы скоро свяжемся с вами.',
        'success',
      );
    } catch (error) {
      showFormMessage(
        error.message || 'Ошибка отправки. Попробуйте позже.',
        'error',
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }

      if (submitButtonText) {
        submitButtonText.textContent = 'Отправить сообщение';
      }
    }
  });
}

updateCartCounter();
initContactsForm();
