document.addEventListener('DOMContentLoaded', () => {
    loadAllocationQueue();
});

// Strategy descriptions
const strategyExplanations = {
    'Priority First': 'Priority First strategy sorts all orders by their auto-computed Priority Score. Available stock is distributed sequentially, satisfying higher priority orders in full first before remaining stock is given to lower priority orders.',
    'Earliest Due Date': 'Earliest Due Date strategy prioritizes orders based on their SLA target due date. Orders with closer deadlines are fulfilled first, minimizing penalty risks regardless of customer tier or order size.',
    'VIP First': 'VIP Customers First strategy sorts orders based on the customer level tier (VIP, then Premium, then Regular). In case of a shortage, VIP customers receive priority stock allocation.',
    'Fair Share': 'Fair Share strategy distributes available stock proportionally among all orders requesting that item (e.g. allocation = stock * (order_demand / total_demand)). It ensures all clients receive partial shipments.'
};

function updateStrategyInfo() {
    const select = document.getElementById('allocation-strategy');
    const explanation = document.getElementById('strategy-explanation');
    explanation.textContent = strategyExplanations[select.value];
}

async function loadAllocationQueue() {
    try {
        const orders = await fetchAPI('/orders');
        // Filter orders in "Created", "Pending Allocation" or "Partially Allocated"
        const pendingOrders = orders.filter(o => 
            o.status === 'Created' || 
            o.allocation_status === 'Pending Allocation' || 
            o.allocation_status === 'Partially Allocated'
        );
        
        renderQueueTable(pendingOrders);
        renderDecisionLogs();
    } catch (e) {
        console.error(e);
    }
}

function renderQueueTable(orders) {
    const tbody = document.querySelector('#allocation-queue-table tbody');
    tbody.innerHTML = '';
    
    document.getElementById('pending-allocation-count').textContent = `${orders.length} Orders Pending`;
    
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px 0;">All warehouse orders have been allocated stock!</td></tr>`;
        return;
    }
    
    orders.forEach(order => {
        const tr = document.createElement('tr');
        
        // Sum requested items
        const itemsSummary = order.items.map(it => `${it.quantity}x ${it.product_id}`).join(', ');
        
        tr.innerHTML = `
            <td><a href="order-details.html?id=${order._id}" style="color: var(--primary); text-decoration: none; font-weight: 700;">${order._id}</a></td>
            <td style="font-weight: 600;">${order.customer} <span style="font-size: 11px; color: var(--text-secondary);">(${order.customer_type})</span></td>
            <td><span class="badge ${getPriorityBadgeClass(order.priority_score)}">${order.priority}</span></td>
            <td style="font-weight: 700;">${order.priority_score.toFixed(0)}</td>
            <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${itemsSummary}">${itemsSummary}</td>
            <td><span class="badge ${order.allocation_status.toLowerCase().replace(' ', '-')}">${order.allocation_status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="allocateSingleOrder('${order._id}')">
                    <i class="fas fa-magic"></i> Allocate
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function runAllocation() {
    const strategy = document.getElementById('allocation-strategy').value;
    
    try {
        showLoading(true);
        
        // Fetch orders first to get an ID we can use to trigger the endpoint
        const orders = await fetchAPI('/orders');
        const pending = orders.filter(o => o.status === 'Created' || o.allocation_status === 'Pending Allocation' || o.allocation_status === 'Partially Allocated');
        
        if (pending.length === 0) {
            showToast('No orders require stock allocation.', 'info');
            showLoading(false);
            return;
        }
        
        // Trigger allocation on the first pending order ID (which runs global allocation internally)
        const targetId = pending[0]._id;
        const res = await fetchAPI(`/orders/${targetId}/allocate`, {
            method: 'POST',
            body: { strategy }
        });
        
        showToast(res.message, 'success');
        
        // Reload table & decisions
        await loadAllocationQueue();
        
    } catch (e) {
        console.error(e);
    } finally {
        showLoading(false);
    }
}

async function allocateSingleOrder(id) {
    const strategy = document.getElementById('allocation-strategy').value;
    try {
        const res = await fetchAPI(`/orders/${id}/allocate`, {
            method: 'POST',
            body: { strategy }
        });
        showToast(`Allocation run completed for order ${id}.`, 'success');
        loadAllocationQueue();
    } catch (e) {
        console.error(e);
    }
}

async function renderDecisionLogs() {
    try {
        const decisions = await fetchAPI('/decisions');
        const activeDecs = decisions.filter(d => d.status === 'Pending');
        const panel = document.getElementById('allocation-decision-panel');
        
        if (activeDecs.length === 0) {
            panel.style.display = 'none';
            return;
        }
        
        panel.style.display = 'block';
        const box = document.getElementById('decision-alert-box');
        const title = document.getElementById('decision-alert-title');
        const body = document.getElementById('decision-alert-body');
        
        // Use the latest decision to display
        const latest = activeDecs[activeDecs.length - 1];
        
        title.innerHTML = `<i class="fas fa-exclamation-triangle icon-spacing" style="color: var(--primary);"></i> Shortage Detected: ${latest.problem}`;
        body.innerHTML = `
            <strong>Decision taken by system:</strong> ${latest.decision}<br>
            <strong>Reasoning:</strong> ${latest.reason}<br>
            <strong>Impact:</strong> ${latest.impact}<br>
            <strong style="color: var(--primary);">System Recommendation:</strong> ${latest.recommended_action}<br>
            <div style="margin-top:12px;">
                <a href="decision-center.html" class="btn btn-primary btn-sm"><i class="fas fa-external-link-alt"></i> Resolve in Decision Center</a>
            </div>
        `;
    } catch (e) {
        console.error(e);
    }
}
