document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#adminLoginForm');
  const message = document.querySelector('#adminLoginMessage');

  if (!form) {
    return;
  }

  function setMessage(text, type = 'error') {
    if (!message) {
      return;
    }

    message.textContent = text;
    message.className = `admin-message admin-message--${type}`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const payload = {
      login: String(formData.get('login') || '').trim(),
      password: String(formData.get('password') || ''),
    };

    if (!payload.login || !payload.password) {
      setMessage('Введите логин и пароль');
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Входим...';
      }

      setMessage('', 'info');

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || 'Не удалось войти');
      }

      setMessage('Вход выполнен', 'success');

      window.location.href = '/admin/products.html';
    } catch (error) {
      setMessage(error.message || 'Ошибка входа');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Войти';
      }
    }
  });
});
