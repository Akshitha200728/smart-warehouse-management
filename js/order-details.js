document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    
    if (!orderId) {
        showToast('No order ID provided.', 'error');
        setTimeout(() => { window.location.href = 'orders.html'; }, 2000);
        return;
    }
    
    loadOrderDetail(orderId);
});

async function loadOrderDetail(id) {
    try {
        const order = await fetchAPI(`/orders/${id}`, { method: 'GET' });
        renderOrderDetail(order);
    } catch (e) {
        console.error('Error fetching order detail:', e);
    }
}

function renderOrderDetail(order) {
    // Basic Timestamps
    document.getElementById('order-date-text').textContent = formatDate(order.order_date);
    document.getElementById('due-date-text').textContent = formatDate(order.due_date);
    
    // Priority Badges
    const priorityBadge = document.getElementById('priority-tag-text');
    priorityBadge.innerHTML = `<span class="badge ${getPriorityBadgeClass(order.priority_score)}">${order.priority}</span>`;
    
    const allocBadge = document.getElementById('alloc-tag-text');
    allocBadge.innerHTML = `<span class="badge ${order.allocation_status.toLowerCase().replace(' ', '-')}">${order.allocation_status}</span>`;
    
    // Priority score numerical
    document.getElementById('priority-score-num').textContent = order.priority_score.toFixed(0);
    
    // Score Badge Class
    const scoreBadge = document.getElementById('priority-classification-badge');
    scoreBadge.className = `badge ${getPriorityBadgeClass(order.priority_score)}`;
    scoreBadge.textContent = `${order.priority} Priority`;
    
    // Score Breakdown list
    const breakdownContainer = document.getElementById('priority-breakdown-container');
    breakdownContainer.innerHTML = '';
    order.priority_breakdown.forEach(item => {
        const row = document.createElement('div');
        row.className = 'breakdown-item';
        const parts = item.split(' (+');
        const desc = parts[0];
        const pts = '+' + parts[1].replace(' pts)', '');
        
        row.innerHTML = `
            <span style="color: var(--text-secondary);">${desc}</span>
            <strong style="color: var(--primary);">${pts}</strong>
        `;
        breakdownContainer.appendChild(row);
    });
    
    // Renders Pipeline
    renderPipeline(order);
    
    // Items table
    renderItemsTable(order.items);
    
    // History logs
    renderHistory(order.history);
    
    // Dynamic Action Button
    renderActionButton(order);
}

function renderPipeline(order) {
    const bar = document.getElementById('pipeline-bar');
    const nodes = {
        created: document.getElementById('node-created'),
        allocated: document.getElementById('node-allocated'),
        picking: document.getElementById('node-picking'),
        packing: document.getElementById('node-packing'),
        qa: document.getElementById('node-qa'),
        dispatch: document.getElementById('node-dispatch')
    };
    
    // Reset all nodes classes
    Object.values(nodes).forEach(node => {
        node.className = 'pipeline-node';
    });
    
    let progressPct = 0;
    
    const status = order.status;
    const picking = order.picking_status;
    const packing = order.packing_status;
    const qa = order.quality_check_status;
    
    // Stage evaluation
    if (status === 'Cancelled') {
        bar.style.backgroundColor = 'var(--danger)';
        bar.style.width = '100%';
        return;
    }
    
    // Created stage
    nodes.created.classList.add('completed');
    
    // Allocated stage
    if (order.allocation_status === 'Fully Allocated') {
        nodes.allocated.classList.add('completed');
        progressPct = 20;
    } else if (order.allocation_status === 'Partially Allocated') {
        nodes.allocated.classList.add('active');
        progressPct = 10;
    } else {
        nodes.allocated.classList.add('active');
        progressPct = 0;
    }
    
    // Picking stage
    if (picking === 'Completed') {
        nodes.allocated.className = 'pipeline-node completed';
        nodes.picking.classList.add('completed');
        progressPct = 40;
    } else if (picking === 'In Progress') {
        nodes.picking.classList.add('active');
        progressPct = 30;
    } else if (picking === 'Exception') {
        nodes.picking.classList.add('at-risk');
        progressPct = 30;
    }
    
    // Packing stage
    if (packing === 'Completed') {
        nodes.picking.className = 'pipeline-node completed';
        nodes.packing.classList.add('completed');
        progressPct = 60;
    } else if (packing === 'In Progress') {
        nodes.packing.classList.add('active');
        progressPct = 50;
    } else if (packing === 'Exception') {
        nodes.packing.classList.add('at-risk');
        progressPct = 50;
    }
    
    // Quality Check stage
    if (qa === 'Approved') {
        nodes.packing.className = 'pipeline-node completed';
        nodes.qa.classList.add('completed');
        progressPct = 80;
    } else if (qa === 'Rejected') {
        nodes.qa.classList.add('at-risk');
        progressPct = 70;
    } else if (packing === 'Completed') {
        nodes.qa.classList.add('active');
        progressPct = 70;
    }
    
    // Dispatch stage
    if (status === 'Dispatched') {
        nodes.qa.className = 'pipeline-node completed';
        nodes.dispatch.classList.add('completed');
        progressPct = 100;
    } else if (qa === 'Approved') {
        nodes.dispatch.classList.add('active');
        progressPct = 90;
    }
    
    // If order is delayed general mark active node at-risk
    if (status === 'Delayed') {
        const activeNode = Object.values(nodes).find(n => n.classList.contains('active'));
        if (activeNode) {
            activeNode.className = 'pipeline-node at-risk';
        }
    }
    
    bar.style.width = `${progressPct}%`;
}

function renderItemsTable(items) {
    const tbody = document.querySelector('#order-items-table tbody');
    tbody.innerHTML = '';
    
    items.forEach(item => {
        const qty = item.quantity;
        const alloc = item.allocated;
        
        let statusBadge = '';
        if (alloc >= qty) {
            statusBadge = '<span class="badge healthy"><i class="fas fa-check"></i> Allocated</span>';
        } else if (alloc > 0) {
            statusBadge = '<span class="badge low-stock"><i class="fas fa-exclamation"></i> Partially Allocated</span>';
        } else {
            const avail = item.available_stock || 0;
            if (avail === 0) {
                statusBadge = '<span class="badge out-of-stock"><i class="fas fa-times"></i> Shortage (OOS)</span>';
            } else {
                statusBadge = '<span class="badge status-created"><i class="fas fa-clock"></i> Pending</span>';
            }
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.sku || 'N/A'}</td>
            <td style="font-weight:600;">${item.name || 'Unknown Item'}</td>
            <td><span style="font-family:monospace; color:var(--primary); font-weight:700;">${item.location || '-'}</span></td>
            <td>${qty}</td>
            <td style="font-weight:700; color:${alloc >= qty ? 'var(--success)' : 'var(--warning)'};">${alloc}</td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderHistory(history) {
    const container = document.getElementById('history-container');
    container.innerHTML = '';
    
    if (!history || history.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">No history records available.</p>`;
        return;
    }
    
    // Sort history by date descending
    const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sorted.forEach(log => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="history-dot"></div>
            <div class="history-body">
                <div style="display:flex; justify-content:space-between; font-weight:600;">
                    <span>${log.status}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${formatDate(log.timestamp)}</span>
                </div>
                <p style="font-size:12.5px; color:var(--text-secondary); margin-top:2px;">${log.comment || ''}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(order) {
    const container = document.getElementById('dynamic-action-area');
    container.innerHTML = '';
    
    const status = order.status;
    const alloc = order.allocation_status;
    const picking = order.picking_status;
    const packing = order.packing_status;
    const qa = order.quality_check_status;
    
    if (status === 'Cancelled' || status === 'Dispatched') {
        return; // No actions
    }
    
    // Option 1: Trigger Allocation
    if (alloc === 'Pending Allocation' || alloc === 'Partially Allocated') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerHTML = `<i class="fas fa-brain"></i> Execute Smart Allocation`;
        btn.onclick = () => triggerAllocation(order._id);
        container.appendChild(btn);
    }
    
    // Option 2: Start Picking
    else if (picking === 'Pending' || picking === 'Exception') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerHTML = `<i class="fas fa-dolly-flatbed"></i> Dispatch Picker & Start Picking`;
        btn.onclick = () => triggerPicking(order._id);
        container.appendChild(btn);
    }
    
    // Option 3: Go to Picking Task
    else if (picking === 'In Progress') {
        const a = document.createElement('a');
        a.className = 'btn btn-primary';
        a.href = 'picking.html';
        a.innerHTML = `<i class="fas fa-running"></i> Open Active Picking Screen`;
        container.appendChild(a);
    }
    
    // Option 4: Go to Packing Station
    else if (packing === 'Pending' || packing === 'In Progress' || packing === 'Exception') {
        const a = document.createElement('a');
        a.className = 'btn btn-primary';
        a.href = 'packing.html';
        a.innerHTML = `<i class="fas fa-box-open"></i> Go to Packing Station`;
        container.appendChild(a);
    }
    
    // Option 5: Conduct QA
    else if (packing === 'Completed' && qa !== 'Approved') {
        const a = document.createElement('a');
        a.className = 'btn btn-primary';
        a.href = 'quality-check.html';
        a.innerHTML = `<i class="fas fa-clipboard-check"></i> Open QA Verification`;
        container.appendChild(a);
    }
    
    // Option 6: Dispatch Order
    else if (qa === 'Approved' && status !== 'Dispatched') {
        const a = document.createElement('a');
        a.className = 'btn btn-primary';
        a.href = 'dispatch.html';
        a.innerHTML = `<i class="fas fa-shipping-fast"></i> Route to Dispatch Panel`;
        container.appendChild(a);
    }
}

async function triggerAllocation(orderId) {
    try {
        const res = await fetchAPI(`/orders/${orderId}/allocate`, {
            method: 'POST',
            body: { strategy: 'Priority First' }
        });
        
        if (res.success) {
            showToast('Smart allocation algorithm completed.', 'success');
            loadOrderDetail(orderId);
        }
    } catch (e) {
        console.error(e);
    }
}

async function triggerPicking(orderId) {
    try {
        const res = await fetchAPI(`/orders/${orderId}/pick`, {
            method: 'POST'
        });
        
        if (res.success) {
            showToast('Picking task assigned and routes optimized.', 'success');
            setTimeout(() => {
                window.location.href = 'picking.html';
            }, 1000);
        }
    } catch (e) {
        console.error(e);
    }
}
