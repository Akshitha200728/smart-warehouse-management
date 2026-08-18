document.addEventListener('DOMContentLoaded', () => {
    loadDispatchTasks();
});

async function loadDispatchTasks() {
    try {
        const tasks = await fetchAPI('/dispatches', { method: 'GET' });
        renderDispatchTasks(tasks);
    } catch (e) {
        console.error(e);
    }
}

function renderDispatchTasks(tasks) {
    const container = document.getElementById('dispatch-tasks-container');
    container.innerHTML = '';
    
    document.getElementById('dispatch-active-count').textContent = `${tasks.length} Shipments`;
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-truck" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h4>No shipments ready for dispatch</h4>
                <p style="font-size:13px;">Complete packing and pass QA check stages first.</p>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'glass-card dispatch-card';
        
        const carrierSelectId = `carrier-select-${task.order_id}`;
        
        card.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom:8px; margin-bottom:12px;">
                    <strong style="color:var(--primary); font-size:15px;">${task.order_id}</strong>
                    <span class="badge ${getPriorityBadgeClass(task.priority)}">${task.priority} Priority</span>
                </div>
                <div style="font-size:13px; margin-bottom:4px;">Customer: <strong style="color:var(--text-primary);">${task.customer}</strong></div>
                
                <div class="dispatch-meta">
                    <div>Gross Weight: <strong>${task.weight} kg</strong></div>
                    <div>Status: <span class="badge healthy">${task.status}</span></div>
                </div>
                
                <div class="form-group" style="margin-top:10px;">
                    <label for="${carrierSelectId}">Logistics Shipping Carrier</label>
                    <select id="${carrierSelectId}" class="form-control">
                        <option value="FedEx Priority Freight" ${task.priority === 'Critical' ? 'selected' : ''}>FedEx Priority Freight</option>
                        <option value="DHL Express Worldwide" ${task.priority === 'Urgent' ? 'selected' : ''}>DHL Express Worldwide</option>
                        <option value="UPS Ground Service" ${task.priority === 'Normal' ? 'selected' : ''}>UPS Ground Service</option>
                        <option value="Local Courier Dispatch" ${task.priority === 'Low' ? 'selected' : ''}>Local Courier Dispatch</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-top: 14px;">
                <button class="btn btn-primary" onclick="dispatchShipment('${task.order_id}')" style="width: 100%; justify-content: center;">
                    <i class="fas fa-truck-loading"></i> Ship Consignment
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

async function dispatchShipment(orderId) {
    const carrier = document.getElementById(`carrier-select-${orderId}`).value;
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    
    try {
        const res = await fetchAPI(`/orders/${orderId}/dispatch`, {
            method: 'POST',
            body: {
                carrier: carrier,
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            // Populate Confirmation Modal
            document.getElementById('confirm-order-id').textContent = orderId;
            document.getElementById('confirm-carrier-text').textContent = carrier;
            document.getElementById('confirm-tracking-text').textContent = res.tracking_number;
            
            openModal('dispatch-confirm-modal');
            loadDispatchTasks();
        }
    } catch (e) {
        console.error(e);
    }
}
