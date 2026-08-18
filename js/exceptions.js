document.addEventListener('DOMContentLoaded', () => {
    loadExceptions();
    
    // Poll updates
    setInterval(loadExceptions, 15000);
});

async function loadExceptions() {
    try {
        const exceptions = await fetchAPI('/exceptions', { method: 'GET' });
        renderExceptionsTable(exceptions);
    } catch (e) {
        console.error(e);
    }
}

function renderExceptionsTable(exceptions) {
    const tbody = document.querySelector('#exceptions-table tbody');
    tbody.innerHTML = '';
    
    const activeCount = exceptions.filter(e => e.status === 'Active').length;
    document.getElementById('active-exceptions-count').textContent = `${activeCount} Active Issues`;
    
    if (exceptions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No system exceptions recorded. Systems healthy.</td></tr>`;
        return;
    }
    
    exceptions.forEach(exc => {
        const tr = document.createElement('tr');
        
        let severityBadge = '';
        const s = exc.severity.toLowerCase();
        if (s === 'critical') severityBadge = '<span class="badge priority-critical"><i class="fas fa-skull-crossbones"></i> Critical</span>';
        else if (s === 'high') severityBadge = '<span class="badge priority-urgent"><i class="fas fa-exclamation-circle"></i> High</span>';
        else if (s === 'medium') severityBadge = '<span class="badge priority-high"><i class="fas fa-exclamation-triangle"></i> Medium</span>';
        else severityBadge = '<span class="badge priority-normal">Low</span>';
        
        let actionBtn = '';
        if (exc.status === 'Active') {
            actionBtn = `
                <a href="decision-center.html" class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size:11px;">
                    <i class="fas fa-balance-scale"></i> Resolve
                </a>
            `;
        } else {
            actionBtn = `<span style="color:var(--text-muted); font-size:12px;"><i class="fas fa-check-circle"></i> Done</span>`;
        }
        
        tr.innerHTML = `
            <td><strong style="font-size:12px; color:var(--text-secondary);">${exc._id}</strong></td>
            <td>${severityBadge}</td>
            <td style="font-weight:600;">${exc.exception_type}</td>
            <td><a href="order-details.html?id=${exc.order_id}" style="color:var(--primary); text-decoration:none; font-weight:700;">${exc.order_id || '-'}</a></td>
            <td style="font-size:12.5px; color:var(--text-secondary); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${exc.problem}">${exc.problem}</td>
            <td style="font-size:12.5px; color:var(--text-secondary); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${exc.impact}">${exc.impact}</td>
            <td style="font-size:12px; color:var(--text-muted);">${formatDate(exc.timestamp)}</td>
            <td><span class="badge ${exc.status === 'Active' ? 'status-exception' : 'status-dispatched'}">${exc.status}</span></td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}
