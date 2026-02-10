function showNotification(message, type = 'success') {
    const note = document.getElementById('notification');
    note.textContent = message;
    note.className = type === 'success' ? 'bg-success' : 'bg-error';
    note.style.display = 'block';
    setTimeout(() => { note.style.display = 'none'; }, 3000);
}

function toggleAuth() {
    const login = document.getElementById('loginContainer');
    const register = document.getElementById('registerContainer');
    if (login.style.display === 'none') {
        login.style.display = 'block';
        register.style.display = 'none';
    } else {
        login.style.display = 'none';
        register.style.display = 'block';
    }
}

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginId').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (res.ok) {
            showNotification('Login successful!');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);
        } else {
            showNotification(data.error || 'Login failed', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (res.ok) {
            showNotification('Registration successful! Please sign in.');
            toggleAuth();
        } else {
            showNotification(data.error || 'Registration failed', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
});

// Mobile Menu Toggle
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
    document.getElementById('menuToggle').classList.toggle('open');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('navLinks');
    const toggle = document.getElementById('menuToggle');
    if (menu.classList.contains('active') && !menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove('active');
        toggle.classList.remove('open');
    }
});
