document.addEventListener('DOMContentLoaded', () => {
    loadDecisions();
    
    // Poll updates
    setInterval(loadDecisions, 15000);
});

async function loadDecisions() {
    try {
        const decisions = await fetchAPI('/decisions', { method: 'GET' });
        renderDecisions(decisions);
    } catch (e) {
        console.error(e);
    }
}

function renderDecisions(decisions) {
    const container = document.getElementById('decisions-container');
    container.innerHTML = '';
    
    const pendingDecs = decisions.filter(d => d.status === 'Pending');
    document.getElementById('pending-decisions-count').textContent = `${pendingDecs.length} Decisions Pending`;
    
    if (decisions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fas fa-brain" style="font-size: 40px; color: var(--text-muted); margin-bottom: 12px;"></i>
                <h4>Decision logs clear</h4>
                <p style="font-size:13px;">No operational issues require system resolution decisions.</p>
            </div>
        `;
        return;
    }
    
    decisions.forEach(dec => {
        const card = document.createElement('div');
        const stateClass = dec.status.toLowerCase();
        card.className = `glass-card decision-card ${stateClass}`;
        
        let actionBtn = '';
        if (dec.status === 'Pending') {
            actionBtn = `
                <div style="display:flex; gap:8px; margin-top:16px;">
                    <button class="btn btn-success" onclick="approveDecision('${dec._id}')" style="flex: 1.5; justify-content: center;">
                        <i class="fas fa-check-circle"></i> Approve Resolution
                    </button>
                    <button class="btn btn-secondary" onclick="rejectDecision('${dec._id}')" style="flex: 1; justify-content: center;">
                        <i class="fas fa-times-circle"></i> Reject
                    </button>
                </div>
            `;
        } else {
            const badgeClass = dec.status === 'Approved' ? 'badge healthy' : 'badge out-of-stock';
            actionBtn = `
                <div style="margin-top:16px; text-align:center; border: 1px solid var(--border-color); padding: 8px; border-radius:4px; background: rgba(255,255,255,0.01);">
                    <span class="${badgeClass}"><i class="fas ${dec.status === 'Approved' ? 'fa-check' : 'fa-times'}"></i> Decision ${dec.status}</span>
                    ${dec.resolved_at ? `<div style="font-size:10px; color:var(--text-muted); margin-top:4px;">Resolved: ${formatDate(dec.resolved_at)}</div>` : ''}
                </div>
            `;
        }
        
        // Context data formatting helper
        let dataSummary = '';
        if (dec.data) {
            dataSummary = Object.entries(dec.data)
                .map(([key, val]) => `<span style="margin-right:12px;">${key.replace('_', ' ')}: <strong style="color:var(--text-primary);">${val}</strong></span>`)
                .join('');
        }
        
        card.innerHTML = `
            <div>
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom:8px; margin-bottom:12px;">
                    <strong style="color:var(--primary); font-size:12px;">DECISION BLOCK #${dec._id.split('-').pop()}</strong>
                    <span class="badge ${dec.status === 'Pending' ? 'low-stock' : 'status-created'}">${dec.status}</span>
                </div>
                
                <div class="decision-block">
                    <strong>Problem Statement</strong>
                    <span style="font-weight:600; color:var(--text-primary);">${dec.problem}</span>
                </div>
                
                <div class="decision-details-box" style="font-size:11px; color:var(--text-secondary);">
                    ${dataSummary}
                </div>
                
                <div class="decision-block">
                    <strong>Engine Decision</strong>
                    <span>${dec.decision}</span>
                </div>
                
                <div class="decision-block">
                    <strong>Reasoning Rationale</strong>
                    <span>${dec.reason}</span>
                </div>
                
                <div class="decision-block">
                    <strong>Operational Impact</strong>
                    <span>${dec.impact}</span>
                </div>
                
                <div class="decision-block" style="border-left: 2px solid var(--primary); padding-left: 8px;">
                    <strong>Recommended Action</strong>
                    <span style="color:var(--primary); font-weight:600;">${dec.recommended_action}</span>
                </div>
            </div>
            
            ${actionBtn}
        `;
        container.appendChild(card);
    });
}

async function approveDecision(id) {
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/decisions/${id}/approve`, {
            method: 'POST',
            body: {
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            showToast(res.message, 'success');
            loadDecisions();
        }
    } catch (e) {
        console.error(e);
    }
}

async function rejectDecision(id) {
    try {
        const res = await fetchAPI(`/decisions/${id}/reject`, {
            method: 'POST'
        });
        if (res.success) {
            showToast('Decision recommendation dismissed.', 'info');
            loadDecisions();
        }
    } catch (e) {
        console.error(e);
    }
}
