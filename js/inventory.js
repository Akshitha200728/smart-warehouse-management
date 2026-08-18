let currentAdjustMode = 'adjustment'; // 'adjustment' or 'edit'

document.addEventListener('DOMContentLoaded', () => {
    // Check if there is a search query in the URL (redirect from dashboard)
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('search');
    if (searchQuery) {
        document.getElementById('inventory-search').value = searchQuery;
    }
    
    // Auto-open Add Product modal if action=add is set
    const action = urlParams.get('action');
    if (action === 'add') {
        setTimeout(openAddProductModal, 150);
    }
    
    // Initial fetch of products
    loadProducts();
    
    // Bind filters
    document.getElementById('inventory-search').addEventListener('input', debounce(loadProducts, 300));
    document.getElementById('category-filter').addEventListener('change', loadProducts);
    document.getElementById('status-filter').addEventListener('change', loadProducts);
    
    // Bind Add Product Form submit
    document.getElementById('add-product-form').addEventListener('submit', handleAddProduct);
    
    // Bind Adjust Stock Form submit
    document.getElementById('adjust-stock-form').addEventListener('submit', handleAdjustStock);
});

// Load and Render Products Table
async function loadProducts() {
    const search = document.getElementById('inventory-search').value;
    const category = document.getElementById('category-filter').value;
    const status = document.getElementById('status-filter').value;
    
    let queryParams = [];
    if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
    if (category) queryParams.push(`category=${encodeURIComponent(category)}`);
    if (status) queryParams.push(`status=${encodeURIComponent(status)}`);
    
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    
    try {
        const products = await fetchAPI(`/products${queryString}`, { method: 'GET' });
        renderTable(products);
    } catch (e) {
        console.error('Error fetching inventory products:', e);
    }
}

function renderTable(products) {
    const tbody = document.querySelector('#inventory-table tbody');
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No matching products found in warehouse inventory.</td></tr>`;
        return;
    }
    
    products.forEach(p => {
        const inv = p.inventory;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--text-secondary);">${p._id}</strong></td>
            <td>${p.sku}</td>
            <td style="font-weight: 600;">${p.name}</td>
            <td>${p.category}</td>
            <td><span style="font-family: monospace; color: var(--primary); font-weight: 700;">${inv.location}</span></td>
            <td style="font-weight: 700;">${inv.total_stock}</td>
            <td style="color: var(--success); font-weight: 700;">${inv.available_stock}</td>
            <td style="color: var(--info); font-weight: 600;">${inv.reserved_stock}</td>
            <td style="color: var(--danger); font-weight: 600;">${inv.damaged_stock}</td>
            <td>${inv.reorder_level}</td>
            <td><span class="badge ${inv.status.toLowerCase().replace(' ', '-')}">${inv.status}</span></td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-secondary btn-sm" onclick="openAdjustModal('${p._id}', '${p.sku}', '${p.name.replace(/'/g, "\\'")}', ${inv.available_stock}, '${inv.location}', ${inv.reorder_level}, ${inv.safety_stock}, ${inv.lead_time}, ${inv.avg_daily_demand}, '${p.category}', '${p.description.replace(/'/g, "\\'")}')" title="Adjust Stock levels / Edit Config">
                        <i class="fas fa-sliders-h"></i> Adjust
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p._id}', '${p.sku}')" style="padding: 4px 8px; font-size:11px;" title="Delete Product">
                        <i class="fas fa-trash-alt"></i> Delete
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal open/close helpers
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Add Product Modal
function openAddProductModal() {
    document.getElementById('add-product-form').reset();
    openModal('add-product-modal');
}

async function handleAddProduct(e) {
    e.preventDefault();
    const sku = document.getElementById('prod-sku').value;
    const name = document.getElementById('prod-name').value;
    const category = document.getElementById('prod-category').value;
    const location = document.getElementById('prod-location').value;
    const description = document.getElementById('prod-desc').value;
    const total_stock = document.getElementById('prod-qty').value;
    const reorder_level = document.getElementById('prod-reorder').value;
    const safety_stock = document.getElementById('prod-safety').value;
    const avg_daily_demand = document.getElementById('prod-demand').value;
    const lead_time = document.getElementById('prod-lead').value;
    
    try {
        const res = await fetchAPI('/products', {
            method: 'POST',
            body: {
                sku, name, category, location, description, 
                total_stock, reorder_level, safety_stock, avg_daily_demand, lead_time
            }
        });
        if (res.success) {
            showToast('Product added successfully', 'success');
            closeModal('add-product-modal');
            loadProducts();
        }
    } catch (e) {
        console.error(e);
    }
}

// Adjust Stock Modal & Configuration
function openAdjustModal(pId, sku, name, availStock, location, reorder, safety, lead, demand, category, description) {
    document.getElementById('adjust-prod-id').value = pId;
    document.getElementById('adjust-item-sku').textContent = sku;
    document.getElementById('adjust-item-name').textContent = name;
    document.getElementById('adjust-item-stock').textContent = `Current Stock: ${availStock} available`;
    
    // Fill configuration inputs in case we edit
    document.getElementById('edit-location').value = location;
    document.getElementById('edit-reorder').value = reorder;
    document.getElementById('edit-safety').value = safety;
    document.getElementById('edit-lead').value = lead;
    document.getElementById('edit-demand').value = demand;
    
    // Hold product metadata context
    document.getElementById('adjust-stock-form').dataset.category = category;
    document.getElementById('adjust-stock-form').dataset.description = description;
    document.getElementById('adjust-stock-form').dataset.name = name;
    
    // Reset forms and mode
    document.getElementById('stock-change').value = '';
    document.getElementById('adjust-reason').value = '';
    setAdjustMode('adjustment');
    openModal('adjust-stock-modal');
}

function setAdjustMode(mode) {
    currentAdjustMode = mode;
    if (mode === 'adjustment') {
        document.getElementById('toggle-adj').classList.add('active');
        document.getElementById('toggle-edit').classList.remove('active');
        document.getElementById('section-adjustment').style.display = 'block';
        document.getElementById('section-edit').style.display = 'none';
        document.getElementById('stock-change').setAttribute('required', 'true');
    } else {
        document.getElementById('toggle-adj').classList.remove('active');
        document.getElementById('toggle-edit').classList.add('active');
        document.getElementById('section-adjustment').style.display = 'none';
        document.getElementById('section-edit').style.display = 'block';
        document.getElementById('stock-change').removeAttribute('required');
    }
}

async function handleAdjustStock(e) {
    e.preventDefault();
    const pId = document.getElementById('adjust-prod-id').value;
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    
    let body = {
        action: currentAdjustMode,
        user: currentUser.name || 'Alex Carter'
    };
    
    if (currentAdjustMode === 'adjustment') {
        body.adjustment = parseInt(document.getElementById('stock-change').value);
    } else {
        body.location = document.getElementById('edit-location').value;
        body.reorder_level = parseInt(document.getElementById('edit-reorder').value);
        body.safety_stock = parseInt(document.getElementById('edit-safety').value);
        body.lead_time = parseInt(document.getElementById('edit-lead').value);
        body.avg_daily_demand = parseFloat(document.getElementById('edit-demand').value);
        
        // Retain standard product metadata
        const formDataset = document.getElementById('adjust-stock-form').dataset;
        body.name = formDataset.name;
        body.category = formDataset.category;
        body.description = formDataset.description;
    }
    
    try {
        const res = await fetchAPI(`/products/${pId}`, {
            method: 'PUT',
            body: body
        });
        
        if (res.success) {
            showToast(currentAdjustMode === 'adjustment' ? 'Stock count adjusted' : 'Configuration settings saved', 'success');
            closeModal('adjust-stock-modal');
            loadProducts();
        }
    } catch (e) {
        console.error(e);
    }
}

// Reorder Engine recommendations Modal
async function openReorderRecommendations() {
    const list = document.getElementById('modal-reorder-list');
    list.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner" style="margin: 0 auto 10px auto; width: 30px; height: 30px;"></div>Loading reorder math...</div>';
    openModal('reorder-recs-modal');
    
    try {
        const recs = await fetchAPI('/inventory/reorder-recommendations', { method: 'GET' });
        list.innerHTML = '';
        
        if (recs.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle" style="font-size: 32px; color: var(--success); margin-bottom: 8px;"></i>
                    <p>Fulfillment stock healthy. No products are currently below reorder thresholds.</p>
                </div>
            `;
            return;
        }
        
        recs.forEach(rec => {
            const urgencyBadge = rec.urgency.toLowerCase();
            const item = document.createElement('div');
            item.className = 'reorder-rec-item';
            item.innerHTML = `
                <div class="reorder-rec-item-header">
                    <div>
                        <strong style="font-size: 15px;">${rec.name}</strong>
                        <span style="font-size: 12px; color: var(--text-secondary); margin-left: 8px;">SKU: ${rec.sku}</span>
                    </div>
                    <span class="badge ${urgencyBadge}">${rec.urgency} Urgency</span>
                </div>
                <div class="reorder-rec-item-math">
                    ${rec.reason}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                    <span style="color: var(--text-muted);">Warehouse Bin: <strong style="color: var(--primary);">${rec.location}</strong></span>
                    <button class="btn btn-primary btn-sm" onclick="triggerRestockPurchase('${rec.product_id}', ${rec.recommended_quantity})">
                        <i class="fas fa-shopping-basket"></i> Restock ${rec.recommended_quantity} Units
                    </button>
                </div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        list.innerHTML = `<div class="text-center" style="color: var(--danger); padding:20px;">Failed to run reorder calculations.</div>`;
    }
}

async function triggerRestockPurchase(prodId, qty) {
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/products/${prodId}`, {
            method: 'PUT',
            body: {
                action: 'adjustment',
                adjustment: qty,
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            showToast(`Restock order of ${qty} units processed successfully.`, 'success');
            // Refresh list
            closeModal('reorder-recs-modal');
            loadProducts();
        }
    } catch (e) {
        console.error(e);
    }
}

// Debounce helper for search search-bar
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

async function deleteProduct(id, sku) {
    if (!confirm(`Are you sure you want to delete the product ${sku} from the warehouse? This will remove all associated stock and inventory records.`)) {
        return;
    }
    
    try {
        const res = await fetchAPI(`/products/${id}`, { method: 'DELETE' });
        if (res.success) {
            showToast(res.message, 'success');
            loadProducts();
        }
    } catch (e) {
        console.error('Error deleting product:', e);
    }
}
