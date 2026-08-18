document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            localStorage.setItem('smartfulfill_user', JSON.stringify(data.user));
            showToast(`Welcome back, ${data.user.name}!`, 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            showToast(data.message || 'Login failed. Check credentials.', 'error');
        }
    } catch (err) {
        showToast('Network error connecting to backend server.', 'error');
        console.error(err);
    }
});

// Demo Login Shortcut
function loginDemo(role) {
    if (role === 'admin') {
        document.getElementById('email').value = 'admin@smartfulfill.com';
        document.getElementById('password').value = 'password123';
    } else {
        document.getElementById('email').value = 'picker1@smartfulfill.com';
        document.getElementById('password').value = 'password123';
    }
    
    // Auto submit form
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
}

// Forgot Password Dialog
function forgotPassword() {
    showToast('Demo Mode: Use the Manager or Picker quick login buttons.', 'warning');
}
