let distributionChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadRootCauses();
    // Poll updates every 20 seconds
    setInterval(loadRootCauses, 20000);
});

async function loadRootCauses() {
    try {
        const data = await fetchAPI('/analytics/root-causes', { method: 'GET' });
        renderKPIs(data);
        renderRootCausesTable(data.root_causes);
        renderDistributionChart(data.backlog_by_stage);
    } catch (e) {
        console.error('Error loading root causes analysis:', e);
    }
}

function renderKPIs(data) {
    document.getElementById('directive-recom-text').innerHTML = `
        <strong>${data.primary_bottleneck !== 'None' ? 'Bottleneck Action Item: ' : ''}</strong>
        ${data.operational_directive}
    `;
    
    document.getElementById('kpi-bottleneck-stage').textContent = data.primary_bottleneck;
    document.getElementById('kpi-bottleneck-percentage').textContent = `${data.bottleneck_pct}% of total backlog delay`;
    
    // Total backlogged orders count
    const totalBacklog = Object.values(data.backlog_by_stage).reduce((a, b) => a + b, 0);
    document.getElementById('kpi-backlogged-orders').textContent = totalBacklog;
    
    // Root cause factors count
    document.getElementById('kpi-factors-count').textContent = data.root_causes.length;
}

function renderRootCausesTable(causes) {
    const tbody = document.querySelector('#root-causes-table tbody');
    tbody.innerHTML = '';
    
    if (causes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No delay factors or bottlenecks detected. System is running at optimal throughput!</td></tr>`;
        return;
    }
    
    causes.forEach(c => {
        const tr = document.createElement('tr');
        
        let typeBadgeClass = 'status-created';
        const t = c.type.toLowerCase();
        if (t.includes('shortage')) typeBadgeClass = 'priority-critical';
        else if (t.includes('damaged') || t.includes('missing')) typeBadgeClass = 'priority-urgent';
        else if (t.includes('issue') || t.includes('failure')) typeBadgeClass = 'priority-high';
        else if (t.includes('delay')) typeBadgeClass = 'priority-normal';
        
        let targetLink = 'decision-center.html';
        if (c.stage.includes('Allocation')) targetLink = 'allocation.html';
        else if (c.stage.includes('Picking')) targetLink = 'picking.html';
        else if (c.stage.includes('Packing')) targetLink = 'packing.html';
        else if (c.stage.includes('Quality')) targetLink = 'quality-check.html';
        else if (c.stage.includes('Dispatch')) targetLink = 'dispatch.html';
        
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--text-primary);">${c.title}</td>
            <td><span style="font-weight: 600; font-size:12px; color: var(--primary);">${c.stage}</span></td>
            <td><span class="badge ${typeBadgeClass}" style="font-size: 11px;">${c.type}</span></td>
            <td style="font-weight: 700; text-align:center;">${c.impact_count} order(s)</td>
            <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 240px; overflow:hidden; text-overflow:ellipsis;" title="${c.description}">${c.description}</td>
            <td>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <span style="font-size:12px; color: var(--text-muted); font-style:italic;">${c.remedy}</span>
                    <a href="${targetLink}" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size:10px; width: fit-content;">
                        <i class="fas fa-arrow-right"></i> Open Stage
                    </a>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDistributionChart(stages) {
    const ctx = document.getElementById('pipeline-distribution-chart').getContext('2d');
    
    const labels = Object.keys(stages);
    const dataValues = Object.values(stages);
    
    if (distributionChart) {
        distributionChart.data.labels = labels;
        distributionChart.data.datasets[0].data = dataValues;
        distributionChart.update();
    } else {
        distributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Backlog Volume (Orders)',
                    data: dataValues,
                    backgroundColor: [
                        'rgba(249, 115, 22, 0.6)', // Orange
                        'rgba(59, 130, 246, 0.6)', // Blue
                        'rgba(245, 158, 11, 0.6)', // Yellow
                        'rgba(167, 139, 250, 0.6)', // Purple
                        'rgba(16, 185, 129, 0.6)'  // Green
                    ],
                    borderColor: [
                        '#F97316', '#3B82F6', '#F59E0B', '#A78BFA', '#10B981'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Horizontal bars
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#9CA3AF', stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#9CA3AF', font: { family: 'Outfit', size: 11 } },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}
