let activeTasks = [];
let selectedTask = null;

document.addEventListener('DOMContentLoaded', () => {
    loadPickingTasks();
    initCanvas();
    
    // Bind form
    document.getElementById('picker-exception-form').addEventListener('submit', submitPickerException);
});

async function loadPickingTasks() {
    try {
        activeTasks = await fetchAPI('/picking/tasks', { method: 'GET' });
        renderPickingTasks(activeTasks);
    } catch (e) {
        console.error(e);
    }
}

function renderPickingTasks(tasks) {
    const container = document.getElementById('picking-tasks-list');
    container.innerHTML = '';
    
    // Filter active tasks
    const active = tasks.filter(t => t.status === 'In Progress' || t.status === 'Exception');
    document.getElementById('active-tasks-count').textContent = `${active.length} Active`;
    
    if (active.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-people-carry" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h4>No active picking tasks</h4>
                <p style="font-size:13px;">Assign picking from the Order Details page.</p>
            </div>
        `;
        // Clear canvas
        clearCanvas();
        return;
    }
    
    active.forEach(task => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.style.marginBottom = '16px';
        card.style.cursor = 'pointer';
        card.onclick = () => selectPickingTask(task);
        
        const isSelected = selectedTask && selectedTask._id === task._id;
        if (isSelected) {
            card.style.borderColor = 'var(--primary)';
            card.style.boxShadow = '0 0 10px rgba(249, 115, 22, 0.15)';
        }
        
        const progressPct = task.status === 'Exception' ? 'Exception' : 'In Progress';
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-weight:700; color:var(--primary); font-size:15px;">${task._id}</span>
                <span class="badge ${getStatusBadgeClass(task.status)}">${task.status}</span>
            </div>
            <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:10px; font-size:13px; color:var(--text-secondary);">
                <div>Order Ref: <strong style="color:var(--text-primary);">${task.order_id}</strong></div>
                <div>Picker: <strong>${task.picker}</strong></div>
                <div>Distance: <strong>${task.distance_meters}m</strong></div>
                <div>Items to Pick: <strong>${task.items.reduce((acc, it) => acc + it.quantity, 0)}</strong></div>
            </div>
            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:11px; color:var(--text-muted);">Est. Completion: ${formatDate(task.estimated_completion)}</span>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openCompleteModal('${task._id}')">
                    <i class="fas fa-clipboard-list"></i> Complete Pick
                </button>
            </div>
        `;
        container.appendChild(card);
    });
    
    // Auto-select first task if none selected
    if (!selectedTask && active.length > 0) {
        selectPickingTask(active[0]);
    } else if (selectedTask) {
        // Update selectedTask reference
        const updated = active.find(t => t._id === selectedTask._id);
        if (updated) selectPickingTask(updated);
    }
}

function selectPickingTask(task) {
    selectedTask = task;
    
    // Highlight active card
    loadPickingTasks; // re-rendering will apply selection highlight
    
    // Render route statistics on panel
    document.getElementById('route-distance-text').textContent = `${task.distance_meters} meters`;
    
    // Estimated time (rough conversion)
    const itemsCount = task.items.reduce((acc, it) => acc + it.quantity, 0);
    const estTime = ((task.distance_meters / 60.0) + (itemsCount * 0.25)).toFixed(1);
    document.getElementById('route-time-text').textContent = `${estTime} mins`;
    
    // Path string
    document.getElementById('route-path-sequence').textContent = `Staging -> ` + task.route.join(' -> ') + ` -> Staging`;
    
    // Draw on Canvas
    drawRouteOnCanvas(task);
}

// Canvas Painting Logic
let canvas = null;
let ctx = null;

function initCanvas() {
    canvas = document.getElementById('route-canvas');
    ctx = canvas.getContext('2d');
    clearCanvas();
}

function clearCanvas() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw warehouse grids background
    ctx.fillStyle = '#06090e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
    }
    for (let j = 0; j < canvas.height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
    }
    
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '10px Outfit';
    ctx.fillText('STAGING AREA (X:0, Y:0)', 15, 20);
}

function drawRouteOnCanvas(task) {
    if (!ctx) return;
    clearCanvas();
    
    // Draw Zone Racks/Shelves
    // Zones A, B, C, D
    const zones = [
        { label: 'Zone A', x: 25, y: 40, w: 50, h: 160, color: 'rgba(249, 115, 22, 0.05)' },
        { label: 'Zone B', x: 105, y: 40, w: 50, h: 160, color: 'rgba(59, 130, 246, 0.05)' },
        { label: 'Zone C', x: 185, y: 40, w: 50, h: 160, color: 'rgba(245, 158, 11, 0.05)' },
        { label: 'Zone D', x: 265, y: 40, w: 50, h: 160, color: 'rgba(16, 185, 129, 0.05)' }
    ];
    
    zones.forEach(z => {
        ctx.fillStyle = z.color;
        ctx.fillRect(z.x, z.y, z.w, z.h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '10px Outfit';
        ctx.fillText(z.label, z.x + 8, z.y + 16);
    });
    
    // Helper to calculate pixel position from grid coordinates
    // grid: x (10 to 100), y (shelf offset)
    // Canvas: width 360, height 240
    const scaleX = (gridX) => (gridX / 110) * 320 + 20;
    const scaleY = (gridY) => (gridY / 24) * 200 + 30;
    
    // Draw route path line
    ctx.strokeStyle = '#F97316'; // Safety orange path
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]); // Dotted lines
    
    ctx.beginPath();
    // Start at Staging Area (0,0) -> mapped to (x:15, y:215)
    let startX = scaleX(0);
    let startY = scaleY(0);
    ctx.moveTo(15, 220);
    
    // Gather picking points coordinates
    const points = [];
    
    task.items.forEach(it => {
        const parts = it.location.split('-');
        const zone = parts[0] || 'A';
        const aisle = parseInt(parts[1] || 1);
        const shelf = parseInt(parts[2] || 1);
        
        // Match get_coordinates logic in Python
        const zoneX = { 'A': 10, 'B': 40, 'C': 70, 'D': 100 };
        const x_base = zoneX[zone] || 10;
        const x = x_base + (aisle * 4);
        const y = shelf * 2;
        
        points.push({ x: scaleX(x), y: scaleY(y), label: it.location, quantity: it.quantity });
    });
    
    // Draw lines sequentially
    points.forEach(pt => {
        ctx.lineTo(pt.x, pt.y);
    });
    // Return back to staging
    ctx.lineTo(15, 220);
    ctx.stroke();
    
    // Draw points markers
    ctx.setLineDash([]); // Reset
    
    // Staging Circle
    ctx.beginPath();
    ctx.arc(15, 220, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#EF4444'; // Red staging dot
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.stroke();
    
    points.forEach((pt, index) => {
        // Draw point circle
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#10B981'; // Green shelf target
        ctx.fill();
        ctx.strokeStyle = '#F3F4F6';
        ctx.stroke();
        
        // Draw index badge
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '7px Outfit';
        ctx.fillText(index + 1, pt.x - 2, pt.y + 2);
        
        // Tooltip location label
        ctx.fillStyle = '#9CA3AF';
        ctx.font = '8px Outfit';
        ctx.fillText(pt.label, pt.x + 8, pt.y + 3);
    });
}

// Complete pick Modal checklist
function openCompleteModal(id) {
    const task = activeTasks.find(t => t._id === id);
    if (!task) return;
    
    document.getElementById('checklist-task-id').value = id;
    document.getElementById('checklist-order-id').value = task.order_id;
    
    const container = document.getElementById('checklist-items-container');
    container.innerHTML = '';
    
    task.items.forEach(item => {
        const itemRow = document.createElement('div');
        itemRow.className = 'pick-checklist-item';
        
        // Storing product ID context in data attribute
        itemRow.dataset.productId = item.product_id;
        itemRow.dataset.expectedQty = item.quantity;
        
        itemRow.innerHTML = `
            <div>
                <strong style="color:var(--text-primary); font-size:14px;">${item.name}</strong>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
                    SKU: ${item.sku} | Location: <strong style="color:var(--primary); font-family:monospace;">${item.location}</strong>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; color:var(--text-secondary);">Pick:</span>
                <input type="number" class="form-control pick-checklist-item-input" min="0" max="${item.quantity}" value="${item.quantity}" required>
                <span style="font-size:13px; color:var(--text-muted);">/ ${item.quantity}</span>
            </div>
        `;
        container.appendChild(itemRow);
    });
    
    openModal('complete-pick-modal');
}

async function submitPickChecklist() {
    const taskId = document.getElementById('checklist-task-id').value;
    const orderId = document.getElementById('checklist-order-id').value;
    
    // Check if worker modified counts
    const rows = document.querySelectorAll('.pick-checklist-item');
    const itemsReport = [];
    let mismatchFound = false;
    
    rows.forEach(row => {
        const pid = row.dataset.productId;
        const expected = parseInt(row.dataset.expectedQty);
        const picked = parseInt(row.querySelector('.pick-checklist-item-input').value);
        
        itemsReport.push({ product_id: pid, picked });
        if (picked < expected) {
            mismatchFound = true;
        }
    });
    
    if (mismatchFound) {
        // Confirm if they want to report shortage
        if (!confirm('You entered pick counts lower than requested. This will create short-fulfillment exceptions in the Decision Center. Proceed?')) {
            return;
        }
    }
    
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/picking/tasks/${taskId}/complete`, {
            method: 'POST',
            body: {
                items: itemsReport,
                user: currentUser.name || 'Sarah Miller'
            }
        });
        
        showToast(res.message, 'success');
        closeModal('complete-pick-modal');
        selectedTask = null; // Reset selection
        loadPickingTasks();
        
    } catch (e) {
        console.error(e);
    }
}

// Picker Exception Dialog triggers
function openPickerExceptionModal() {
    const taskId = document.getElementById('checklist-task-id').value;
    const task = activeTasks.find(t => t._id === taskId);
    if (!task) return;
    
    const select = document.getElementById('exc-product-select');
    select.innerHTML = '';
    
    task.items.forEach(it => {
        const opt = document.createElement('option');
        opt.value = it.product_id;
        opt.textContent = `${it.name} (${it.sku})`;
        opt.dataset.qty = it.quantity;
        select.appendChild(opt);
    });
    
    toggleExcInputs();
    openModal('picker-exception-modal');
}

function toggleExcInputs() {
    const type = document.getElementById('exc-type-select').value;
    const qtyContainer = document.getElementById('exc-qty-container');
    const mismatchContainer = document.getElementById('exc-mismatch-container');
    
    if (type === 'Damaged Item') {
        qtyContainer.style.display = 'block';
        mismatchContainer.style.display = 'none';
    } else {
        qtyContainer.style.display = 'none';
        mismatchContainer.style.display = 'grid';
        
        // Fill expected
        const select = document.getElementById('exc-product-select');
        const selectedOpt = select.options[select.selectedIndex];
        if (selectedOpt) {
            const expectedVal = selectedOpt.dataset.qty;
            document.getElementById('exc-expected-qty').value = expectedVal;
            document.getElementById('exc-found-qty').value = Math.max(0, parseInt(expectedVal) - 1);
            document.getElementById('exc-found-qty').setAttribute('max', expectedVal);
        }
    }
}

// Bind dropdown change to update mismatch expected numbers
document.getElementById('exc-product-select').addEventListener('change', toggleExcInputs);

async function submitPickerException(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('checklist-task-id').value;
    const orderId = document.getElementById('checklist-order-id').value;
    const productId = document.getElementById('exc-product-select').value;
    const excType = document.getElementById('exc-type-select').value;
    
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    
    let body = {
        order_id: orderId,
        product_id: productId,
        exception_type: excType,
        user: currentUser.name || 'Sarah Miller',
        severity: 'High'
    };
    
    if (excType === 'Damaged Item') {
        const qty = parseInt(document.getElementById('exc-damage-qty').value);
        body.quantity = qty;
        body.problem = `Damaged stock: reported ${qty} damaged units during picking.`;
    } else {
        const expected = parseInt(document.getElementById('exc-expected-qty').value);
        const found = parseInt(document.getElementById('exc-found-qty').value);
        if (found >= expected) {
            showToast('Actual found quantity must be less than expected to report missing items.', 'warning');
            return;
        }
        body.expected = expected;
        body.found = found;
        body.problem = `Quantity mismatch: expected ${expected}, found ${found} (Shortage: ${expected - found})`;
    }
    
    try {
        const res = await fetchAPI('/exceptions/report', {
            method: 'POST',
            body: body
        });
        
        showToast('Exception reported successfully to Decision Center.', 'warning');
        closeModal('picker-exception-modal');
        closeModal('complete-pick-modal');
        
        // Trigger completion of picker task with Exception state
        await fetchAPI(`/picking/tasks/${taskId}/complete`, {
            method: 'POST',
            body: {
                items: [{ product_id: productId, picked: excType === 'Damaged' ? 0 : document.getElementById('exc-found-qty').value || 0 }],
                user: currentUser.name || 'Sarah Miller'
            }
        });
        
        selectedTask = null;
        loadPickingTasks();
        
    } catch (err) {
        console.error(err);
    }
}
