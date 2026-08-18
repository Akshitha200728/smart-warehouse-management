document.addEventListener('DOMContentLoaded', () => {
    loadPackingTasks();
    
    // Bind forms
    document.getElementById('complete-pack-form').addEventListener('submit', submitPackComplete);
    document.getElementById('pack-issue-form').addEventListener('submit', submitPackIssue);
});

async function loadPackingTasks() {
    try {
        const tasks = await fetchAPI('/packing/tasks', { method: 'GET' });
        renderPackingTasks(tasks);
    } catch (e) {
        console.error(e);
    }
}

function renderPackingTasks(tasks) {
    const container = document.getElementById('packing-tasks-container');
    container.innerHTML = '';
    
    document.getElementById('packing-active-count').textContent = `${tasks.length} Orders`;
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-box" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h4>No orders awaiting packaging</h4>
                <p style="font-size:13px;">Confirm picking tasks first to route shipments here.</p>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'glass-card pack-task-card';
        
        const linesHtml = task.items.map(it => `
            <div class="pack-item-line">
                <span>${it.name} (${it.sku})</span>
                <strong>x${it.quantity}</strong>
            </div>
        `).join('');
        
        let actionBtn = '';
        if (task.status === 'Pending') {
            actionBtn = `
                <button class="btn btn-primary" onclick="startPacking('${task.order_id}')" style="width: 100%; justify-content: center;">
                    <i class="fas fa-box-open"></i> Start Packaging
                </button>
            `;
        } else if (task.status === 'In Progress') {
            actionBtn = `
                <div style="display: flex; gap: 8px; width: 100%;">
                    <button class="btn btn-success" onclick="openCompletePackModal('${task.order_id}', ${task.weight}, '${task.package_type}')" style="flex: 1; justify-content: center;">
                        <i class="fas fa-check"></i> Pack Complete
                    </button>
                    <button class="btn btn-danger" onclick="openPackIssueModal('${task.order_id}')" style="padding: 10px;">
                        <i class="fas fa-exclamation-triangle"></i>
                    </button>
                </div>
            `;
        } else if (task.status === 'Exception') {
            actionBtn = `
                <div style="color: var(--danger); font-size:12.5px; text-align:center; font-weight:700; border:1px solid rgba(239,68,68,0.2); padding:8px; border-radius:4px; background:var(--danger-glow); width:100%;">
                    <i class="fas fa-exclamation-circle"></i> Awaiting Decision Center Resolve
                </div>
            `;
        }
        
        card.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom:8px; margin-bottom:12px;">
                    <strong style="color:var(--primary); font-size:15px;">${task.order_id}</strong>
                    <span class="badge ${getStatusBadgeClass(task.status)}">${task.status}</span>
                </div>
                <div style="font-size:13px; margin-bottom:4px;">Client: <strong style="color:var(--text-primary);">${task.customer}</strong></div>
                <div style="font-size:12px; color:var(--text-secondary);">Default Target: <strong>${task.package_type} (est. ${task.weight} kg)</strong></div>
                
                <div class="pack-items-list">
                    ${linesHtml}
                </div>
            </div>
            
            <div style="margin-top: 14px;">
                ${actionBtn}
            </div>
        `;
        container.appendChild(card);
    });
}

async function startPacking(orderId) {
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/orders/${orderId}/pack`, {
            method: 'POST',
            body: {
                action: 'start',
                user: currentUser.name || 'Alex Carter'
            }
        });
        if (res.success) {
            showToast('Packing assigned. Start packing items.', 'success');
            loadPackingTasks();
        }
    } catch (e) {
        console.error(e);
    }
}

function openCompletePackModal(orderId, weight, type) {
    document.getElementById('pack-order-id').value = orderId;
    document.getElementById('pack-weight').value = weight;
    document.getElementById('pack-box-type').value = type || 'Standard Cargo Box';
    openModal('complete-pack-modal');
}

async function submitPackComplete(e) {
    e.preventDefault();
    const orderId = document.getElementById('pack-order-id').value;
    const boxType = document.getElementById('pack-box-type').value;
    const weight = parseFloat(document.getElementById('pack-weight').value);
    
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/orders/${orderId}/pack`, {
            method: 'POST',
            body: {
                action: 'complete',
                package_type: boxType,
                weight: weight,
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            showToast('Order packed. Routed to QA Check Area.', 'success');
            closeModal('complete-pack-modal');
            loadPackingTasks();
        }
    } catch (err) {
        console.error(err);
    }
}

function openPackIssueModal(orderId) {
    document.getElementById('pack-issue-order-id').value = orderId;
    document.getElementById('pack-issue-desc').value = '';
    openModal('pack-issue-modal');
}

async function submitPackIssue(e) {
    e.preventDefault();
    const orderId = document.getElementById('pack-issue-order-id').value;
    const issueType = document.getElementById('pack-issue-type').value;
    const problem = document.getElementById('pack-issue-desc').value;
    
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/orders/${orderId}/pack`, {
            method: 'POST',
            body: {
                action: 'issue',
                issue_type: issueType,
                problem: problem,
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            showToast('Packing exception recorded.', 'warning');
            closeModal('pack-issue-modal');
            loadPackingTasks();
        }
    } catch (err) {
        console.error(err);
    }
}
