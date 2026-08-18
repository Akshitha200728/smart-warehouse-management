// Global configurations
const API_BASE_URL = 'http://localhost:5000/api';

// Check Auth state immediately on import
function checkAuth() {
    const userStr = localStorage.getItem('smartfulfill_user');
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('login.html');
    
    if (!userStr && !isLoginPage) {
        window.location.href = 'index.html';
        return null;
    }
    return userStr ? JSON.parse(userStr) : null;
}

// Injects Sidebar, Header, Loading Overlay and toast container on page load
document.addEventListener('DOMContentLoaded', () => {
    const user = checkAuth();
    
    // Inject Layout if not on login page
    const layout = document.getElementById('app-layout');
    if (layout) {
        // Create Sidebar
        const sidebar = document.createElement('aside');
        sidebar.className = 'sidebar';
        sidebar.innerHTML = getSidebarHTML(user);
        layout.insertBefore(sidebar, layout.firstChild);
        
        // Create Top Header
        const main = layout.querySelector('main');
        if (main) {
            const header = document.createElement('header');
            header.className = 'top-header';
            header.innerHTML = getHeaderHTML();
            main.insertBefore(header, main.firstChild);
            
            // Set Page Title
            const titleElement = document.querySelector('.page-title');
            if (titleElement) {
                const docTitle = document.title.split(' - ')[0];
                titleElement.textContent = docTitle;
            }
        }
        
        // Highlight Active Link
        highlightActiveMenu();
        
        // Fetch Alert Badge Notifications Count
        updateNotificationBadge();
        
        // Initialize responsive sidebar toggle
        initMobileMenuToggle();
    }
    
    // Inject Toast Container
    const toasts = document.createElement('div');
    toasts.className = 'toast-container';
    toasts.id = 'toast-container';
    document.body.appendChild(toasts);
    
    // Inject Loading Overlay
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.id = 'loading-overlay';
    loader.innerHTML = '<div class="spinner"></div><p style="color: var(--text-secondary); margin-top: 8px;">Processing Warehouse Operations...</p>';
    document.body.appendChild(loader);
});

// Sidebar Definition
function getSidebarHTML(user) {
    const avatar = (user && user.avatar) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces';
    const name = (user && user.name) || 'Guest Worker';
    const role = (user && user.role) || 'Operator';
    
    return `
        <div class="sidebar-brand">
            <div class="brand-icon">
                <i class="fas fa-cubes"></i>
            </div>
            <span class="brand-name">SmartFulfill</span>
        </div>
        <ul class="sidebar-menu">
            <li class="menu-item" data-page="dashboard"><a href="dashboard.html"><i class="fas fa-chart-pie"></i><span>Dashboard</span></a></li>
            <li class="menu-item" data-page="inventory"><a href="inventory.html"><i class="fas fa-boxes"></i><span>Inventory</span></a></li>
            <li class="menu-item" data-page="orders"><a href="orders.html"><i class="fas fa-shopping-cart"></i><span>Orders</span></a></li>
            <li class="menu-item" data-page="allocation"><a href="allocation.html"><i class="fas fa-share-alt"></i><span>Smart Allocation</span></a></li>
            <li class="menu-item" data-page="picking"><a href="picking.html"><i class="fas fa-dolly-flatbed"></i><span>Picking Route</span></a></li>
            <li class="menu-item" data-page="packing"><a href="packing.html"><i class="fas fa-box-open"></i><span>Packing</span></a></li>
            <li class="menu-item" data-page="quality-check"><a href="quality-check.html"><i class="fas fa-clipboard-check"></i><span>Quality Check</span></a></li>
            <li class="menu-item" data-page="dispatch"><a href="dispatch.html"><i class="fas fa-shipping-fast"></i><span>Dispatch</span></a></li>
            <li class="menu-item" data-page="exceptions"><a href="exceptions.html"><i class="fas fa-exclamation-triangle"></i><span>Exception Center</span></a></li>
            <li class="menu-item" data-page="decision-center"><a href="decision-center.html"><i class="fas fa-brain"></i><span>Decision Center</span></a></li>
            <li class="menu-item" data-page="analytics"><a href="analytics.html"><i class="fas fa-chart-line"></i><span>Analytics</span></a></li>
            <li class="menu-item" data-page="notifications"><a href="notifications.html"><i class="fas fa-bell"></i><span>Notifications</span></a></li>
            <li class="menu-item" data-page="settings"><a href="settings.html"><i class="fas fa-cog"></i><span>Settings</span></a></li>
        </ul>
        <div class="sidebar-footer">
            <div class="user-profile">
                <img class="user-avatar" src="${avatar}" alt="Avatar">
                <div class="user-info">
                    <div class="user-name">${name}</div>
                    <div class="user-role">${role}</div>
                </div>
                <button class="logout-btn" onclick="logoutUser()" title="Logout">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </div>
    `;
}

// Header Definition
function getHeaderHTML() {
    return `
        <div class="page-title-area">
            <h1 class="page-title">Operations</h1>
            <span class="page-subtitle">Smart warehouse orchestration system</span>
        </div>
        <div class="header-actions">
            <div class="search-wrapper" style="display: none;">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="Search orders, SKU, tracking...">
            </div>
            <a href="notifications.html" class="header-btn" title="View Alerts">
                <i class="fas fa-bell"></i>
                <span class="btn-badge" id="header-notif-badge" style="display: none;">0</span>
            </a>
            <a href="decision-center.html" class="header-btn" title="Decision Center">
                <i class="fas fa-brain"></i>
            </a>
        </div>
    `;
}

// Nav Link Highlighting
function highlightActiveMenu() {
    const path = window.location.pathname;
    const items = document.querySelectorAll('.menu-item');
    items.forEach(item => {
        const page = item.getAttribute('data-page');
        if (path.includes(page)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Responsive Sidebar Toggle
function initMobileMenuToggle() {
    // Top header left menu toggle
    const titleArea = document.querySelector('.page-title-area');
    if (titleArea) {
        const toggle = document.createElement('button');
        toggle.className = 'header-btn';
        toggle.style.marginRight = '12px';
        toggle.style.display = 'none'; // Will show on CSS media queries
        toggle.innerHTML = '<i class="fas fa-bars"></i>';
        titleArea.parentNode.insertBefore(toggle, titleArea);
        
        toggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('active');
        });
        
        // Add responsive CSS to show mobile menu button
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 992px) {
                .header-btn { display: flex !important; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Update Badge Notification Count
async function updateNotificationBadge() {
    try {
        const response = await fetch(`${API_BASE_URL}/notifications`);
        if (response.ok) {
            const notifs = await response.json();
            const unreadCount = notifs.filter(n => !n.read).length;
            const badge = document.getElementById('header-notif-badge');
            if (badge) {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (e) {
        console.error('Error fetching unread count:', e);
    }
}

// Logout Handler
function logoutUser() {
    localStorage.removeItem('smartfulfill_user');
    showToast('Logged out successfully', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// API Fetch Helper
async function fetchAPI(endpoint, options = {}) {
    showLoading(true);
    try {
        const url = `${API_BASE_URL}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json'
        };
        options.headers = { ...defaultHeaders, ...options.headers };
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
        }
        
        const response = await fetch(url, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

// Toast Manager
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    
    toast.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <div>${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto Remove Toast
    setTimeout(() => {
        toast.style.animation = 'slide-out 0.3s forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}

// Loading Spinner Manager
function showLoading(show) {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }
}

// Utility Formatters
function formatDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getPriorityBadgeClass(score) {
    if (score >= 80) return 'priority-critical';
    if (score >= 60) return 'priority-urgent';
    if (score >= 40) return 'priority-high';
    if (score >= 20) return 'priority-normal';
    return 'priority-low';
}

function getStatusBadgeClass(status) {
    const s = status.toLowerCase();
    if (s.includes('dispatch') || s === 'completed') return 'status-dispatched';
    if (s.includes('allocation') || s === 'allocated') return 'status-allocated';
    if (s === 'picking' || s === 'picked') return 'status-picking';
    if (s === 'packed' || s === 'packing') return 'status-packed';
    if (s.includes('quality') || s.includes('qa')) return 'status-quality';
    if (s === 'delayed') return 'status-delayed';
    if (s === 'exception' || s === 'active') return 'status-exception';
    return 'status-created';
}

// Register CSS keyframe for slide out dynamically if needed
const keyframes = `
@keyframes slide-out {
    to { transform: translateX(120%); opacity: 0; }
}
`;
const styleEl = document.createElement('style');
styleEl.textContent = keyframes;
document.head.appendChild(styleEl);
