document.addEventListener('DOMContentLoaded', () => {
    loadQATasks();
    
    // Bind form
    document.getElementById('reject-qa-form').addEventListener('submit', submitQAReject);
});

async function loadQATasks() {
    try {
        const tasks = await fetchAPI('/quality-checks', { method: 'GET' });
        renderQATasks(tasks);
    } catch (e) {
        console.error(e);
    }
}

function renderQATasks(tasks) {
    const container = document.getElementById('qa-tasks-container');
    container.innerHTML = '';
    
    document.getElementById('qa-active-count').textContent = `${tasks.length} Shipments`;
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-clipboard-check" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h4>No packages awaiting QA Verification</h4>
                <p style="font-size:13px;">Confirm packing tasks first to route packages here.</p>
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'glass-card qa-task-card';
        
        const itemsListStr = task.items.map(it => `${it.quantity}x ${it.name}`).join(', ');
        const cardId = `qa-form-${task.order_id}`;
        
        card.innerHTML = `
            <form id="${cardId}" onsubmit="event.preventDefault();">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom:8px; margin-bottom:12px;">
                    <strong style="color:var(--primary); font-size:15px;">${task.order_id}</strong>
                    <span class="badge status-quality">QA Pending</span>
                </div>
                <div style="font-size:13px; margin-bottom:4px;">Customer: <strong style="color:var(--text-primary);">${task.customer}</strong></div>
                
                <div class="qa-items-summary" title="${itemsListStr}">
                    Items: <strong>${itemsListStr}</strong>
                </div>
                
                <div class="qa-checklist-group">
                    <label class="qa-check-item">
                        <input type="checkbox" class="qa-check" onchange="validateQAChecks('${task.order_id}')" required>
                        <span>Correct product items matched (SKU lookup)</span>
                    </label>
                    <label class="qa-check-item">
                        <input type="checkbox" class="qa-check" onchange="validateQAChecks('${task.order_id}')" required>
                        <span>Quantities verified with picking manifest</span>
                    </label>
                    <label class="qa-check-item">
                        <input type="checkbox" class="qa-check" onchange="validateQAChecks('${task.order_id}')" required>
                        <span>Product packages intact & undamaged</span>
                    </label>
                    <label class="qa-check-item">
                        <input type="checkbox" class="qa-check" onchange="validateQAChecks('${task.order_id}')" required>
                        <span>Carton sealing & padding complete</span>
                    </label>
                    <label class="qa-check-item">
                        <input type="checkbox" class="qa-check" onchange="validateQAChecks('${task.order_id}')" required>
                        <span>Shipping address label scanned & verified</span>
                    </label>
                </div>
                
                <div style="display: flex; gap: 8px; margin-top: 14px;">
                    <button class="btn btn-success btn-approve-qa" id="btn-approve-${task.order_id}" onclick="approveQA('${task.order_id}')" style="flex: 1; justify-content: center;" disabled>
                        <i class="fas fa-check-circle"></i> Approve QA
                    </button>
                    <button class="btn btn-danger" onclick="openRejectQAModal('${task.order_id}')" style="padding: 10px;" title="Reject Shipment">
                        <i class="fas fa-times-circle"></i> Reject
                    </button>
                </div>
            </form>
        `;
        container.appendChild(card);
    });
}

// Validator to enable Approve button ONLY when all checkboxes are checked
function validateQAChecks(orderId) {
    const form = document.getElementById(`qa-form-${orderId}`);
    if (!form) return;
    
    const checkboxes = form.querySelectorAll('.qa-check');
    const btn = document.getElementById(`btn-approve-${orderId}`);
    
    // Toggle checked styles on labels
    checkboxes.forEach(cb => {
        if (cb.checked) {
            cb.parentNode.classList.add('checked');
        } else {
            cb.parentNode.classList.remove('checked');
        }
    });
    
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    btn.disabled = !allChecked;
}

async function approveQA(orderId) {
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/orders/${orderId}/quality-check`, {
            method: 'POST',
            body: {
                action: 'approve',
                user: currentUser.name || 'Alex Carter',
                checks: {
                    product_correct: true,
                    quantity_correct: true,
                    undamaged: true,
                    packaging_correct: true,
                    label_correct: true
                }
            }
        });
        
        if (res.status === 'Approved') {
            showToast('Shipment QA verified successfully. routed to Dispatch.', 'success');
            loadQATasks();
        }
    } catch (e) {
        console.error(e);
    }
}

function openRejectQAModal(orderId) {
    document.getElementById('reject-qa-order-id').value = orderId;
    document.getElementById('reject-comments').value = '';
    openModal('reject-qa-modal');
}

async function submitQAReject(e) {
    e.preventDefault();
    const orderId = document.getElementById('reject-qa-order-id').value;
    const rejectType = document.getElementById('reject-reason-type').value;
    const comments = document.getElementById('reject-comments').value;
    
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/orders/${orderId}/quality-check`, {
            method: 'POST',
            body: {
                action: 'reject',
                user: currentUser.name || 'Alex Carter',
                reason: `${rejectType}: ${comments}`,
                checks: {
                    product_correct: false,
                    quantity_correct: false
                }
            }
        });
        
        if (res.status === 'Rejected') {
            showToast('Package QA rejected. Logged to Exception Center.', 'error');
            closeModal('reject-qa-modal');
            loadQATasks();
        }
    } catch (err) {
        console.error(err);
    }
}
