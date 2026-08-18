let productsList = []; // Cache products for selection drop-downs

document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch of orders
    loadOrders();
    
    // Bind filters
    document.getElementById('order-search').addEventListener('input', debounce(loadOrders, 300));
    document.getElementById('status-filter').addEventListener('change', loadOrders);
    
    // Bind form submit
    document.getElementById('create-order-form').addEventListener('submit', handleCreateOrder);
});

async function loadOrders() {
    const search = document.getElementById('order-search').value;
    const status = document.getElementById('status-filter').value;
    
    let queryParams = [];
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    
    try {
        const orders = await fetchAPI(`/orders${queryString}`, { method: 'GET' });
        renderOrdersTable(orders);
    } catch (e) {
        console.error('Error fetching orders:', e);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No matching warehouse orders found.</td></tr>`;
        return;
    }
    
    orders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--primary);">${order._id}</strong></td>
            <td style="font-weight: 600;">${order.customer}</td>
            <td>${order.customer_type}</td>
            <td>${formatDate(order.order_date)}</td>
            <td>
                <div style="font-size:12px; margin-bottom:4px;">${formatDate(order.due_date)}</div>
                <div class="sla-countdown" data-due="${order.due_date}" data-status="${order.status}"></div>
            </td>
            <td><span class="badge ${getPriorityBadgeClass(order.priority_score)}">${order.priority}</span></td>
            <td style="font-weight: 700;">${order.priority_score.toFixed(0)}</td>
            <td><span class="badge ${order.allocation_status.toLowerCase().replace(' ', '-')}">${order.allocation_status}</span></td>
            <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></td>
            <td>
                <a href="order-details.html?id=${order._id}" class="btn btn-secondary btn-sm">
                    <i class="fas fa-search-plus"></i> View Details
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal management
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

async function openCreateOrderModal() {
    document.getElementById('create-order-form').reset();
    const container = document.getElementById('item-selection-container');
    container.innerHTML = '';
    
    try {
        // Fetch products if cache is empty
        if (productsList.length === 0) {
            productsList = await fetchAPI('/products', { method: 'GET' });
        }
        
        // Add initial row
        addSelectionRow();
        openModal('create-order-modal');
    } catch (e) {
        console.error('Error opening create order modal:', e);
    }
}

function addSelectionRow() {
    const container = document.getElementById('item-selection-container');
    const row = document.createElement('div');
    row.className = 'item-row';
    
    let optionsHtml = productsList.map(p => `<option value="${p._id}">${p.name} (${p.sku})</option>`).join('');
    
    row.innerHTML = `
        <select class="order-item-product" required>
            <option value="" disabled selected>Select product...</option>
            ${optionsHtml}
        </select>
        <input type="number" class="order-item-qty form-control" min="1" value="1" placeholder="Qty" required>
        <button type="button" class="remove-row-btn" onclick="this.parentNode.remove()" title="Remove row">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;
    
    container.appendChild(row);
}

async function handleCreateOrder(e) {
    e.preventDefault();
    
    const customer = document.getElementById('order-customer').value;
    const customer_type = document.getElementById('order-cust-type').value;
    const urgency = document.getElementById('order-urgency').value;
    
    // Collect selected items
    const rows = document.querySelectorAll('.item-row');
    const items = [];
    
    rows.forEach(row => {
        const product_id = row.querySelector('.order-item-product').value;
        const quantity = parseInt(row.querySelector('.order-item-qty').value);
        if (product_id && quantity > 0) {
            items.push({ product_id, quantity });
        }
    });
    
    if (items.length === 0) {
        showToast('Please add at least one line item.', 'warning');
        return;
    }
    
    try {
        const res = await fetchAPI('/orders', {
            method: 'POST',
            body: { customer, customer_type, urgency, items }
        });
        
        if (res.success) {
            showToast(`Order created successfully: ${res.order_id}`, 'success');
            closeModal('create-order-modal');
            loadOrders();
        }
    } catch (e) {
        console.error(e);
    }
}

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
