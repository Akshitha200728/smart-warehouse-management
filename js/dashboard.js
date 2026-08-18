let orderChart = null;
let inventoryChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch of dashboard data
    loadDashboardData();
    
    // Poll updates every 30 seconds for real-time WMS monitoring
    setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
    try {
        // Parallel fetch for speed
        const [analytics, orders, reorderRecs] = await Promise.all([
            fetchAPI('/analytics'),
            fetchAPI('/orders'),
            fetchAPI('/inventory/reorder-recommendations')
        ]);
        
        renderKPIs(analytics, orders);
        renderPriorityQueue(orders);
        renderRecommendations(reorderRecs);
        renderBottleneck(analytics.bottleneck);
        renderCharts(analytics);
        
    } catch (err) {
        console.error('Error loading dashboard data:', err);
    }
}

function renderKPIs(analytics, orders) {
    // Fulfillment Rate
    document.getElementById('kpi-fulfillment-rate').textContent = `${analytics.order_metrics.fulfillment_rate}%`;
    
    // Total Orders / Pending
    document.getElementById('kpi-total-orders').textContent = analytics.order_metrics.total;
    const pendingCount = orders.filter(o => o.status !== 'Dispatched' && o.status !== 'Cancelled').length;
    document.getElementById('kpi-pending-orders-label').textContent = `${pendingCount} active orders`;
    
    // At Risk Orders
    document.getElementById('kpi-at-risk-orders').textContent = analytics.order_metrics.delayed;
    
    // Stock warnings
    const lowStockCount = analytics.inventory_metrics.low_stock;
    const outOfStockCount = analytics.inventory_metrics.out_of_stock;
    document.getElementById('kpi-stock-warnings').textContent = lowStockCount + outOfStockCount;
    document.getElementById('kpi-outofstock-label').textContent = `${outOfStockCount} out-of-stock`;
}

function renderPriorityQueue(orders) {
    const tbody = document.querySelector('#priority-queue-table tbody');
    tbody.innerHTML = '';
    
    // Get active orders (not completed/cancelled) and sort by score descending
    const activeOrders = orders
        .filter(o => o.status !== 'Dispatched' && o.status !== 'Cancelled')
        .slice(0, 5); // top 5
        
    if (activeOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); text-align: center;">No active orders in priority queue.</td></tr>`;
        return;
    }
    
    activeOrders.forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><a href="order-details.html?id=${order._id}" style="color: var(--primary); text-decoration: none; font-weight: 700;">${order._id}</a></td>
            <td>${order.customer} <span style="font-size: 11px; color: var(--text-muted);">(${order.customer_type})</span></td>
            <td><span class="badge ${getPriorityBadgeClass(order.priority_score)}">${order.priority}</span></td>
            <td style="font-weight: 700;">${order.priority_score.toFixed(0)}</td>
            <td><span class="badge ${getStatusBadgeClass(order.status)}">${order.status}</span></td>
            <td>
                <a href="order-details.html?id=${order._id}" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px;">
                    <i class="fas fa-eye"></i> Details
                </a>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRecommendations(recs) {
    const container = document.getElementById('recommendation-list');
    container.innerHTML = '';
    
    const activeRecs = recs.slice(0, 3); // show top 3
    if (activeRecs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-double text-muted" style="font-size: 24px; margin-bottom: 8px;"></i>
                <p>No stock alerts. All key items are healthy.</p>
            </div>
        `;
        return;
    }
    
    activeRecs.forEach(rec => {
        const card = document.createElement('div');
        const urgencyClass = rec.urgency.toLowerCase();
        card.className = `recom-card ${urgencyClass}`;
        
        card.innerHTML = `
            <div class="recom-header">
                <span class="recom-title">${rec.name} (${rec.sku})</span>
                <span class="recom-urgency ${urgencyClass}">${rec.urgency} Reorder</span>
            </div>
            <div class="recom-body">
                ${rec.reason}
            </div>
            <div class="recom-action-row">
                <span class="recom-math">Safety Stock: ${rec.safety_stock} | Predict Demand: ${rec.predicted_demand} units</span>
                <a href="inventory.html?search=${rec.sku}" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 10px;">
                    <i class="fas fa-wrench"></i> Restock
                </a>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderBottleneck(bottleneck) {
    const panel = document.getElementById('bottleneck-panel');
    const desc = document.getElementById('bottleneck-desc');
    const bar = panel.querySelector('.progress-bar-fill');
    const pctText = panel.querySelector('.bottleneck-pct');
    const suggestion = document.getElementById('bottleneck-suggestion');
    
    desc.textContent = `Warehouse bottleneck detected at stage: ${bottleneck.stage}`;
    bar.style.width = `${bottleneck.percentage}%`;
    pctText.textContent = `${bottleneck.percentage}% delay contribution`;
    suggestion.innerHTML = `<strong>System Recommendation:</strong> ${bottleneck.recommendation}`;
    
    // Style adjustments based on severity
    if (bottleneck.percentage >= 40) {
        panel.style.borderLeftColor = 'var(--danger)';
        panel.style.background = 'rgba(239, 68, 68, 0.03)';
        bar.style.backgroundColor = 'var(--danger)';
        pctText.style.color = 'var(--danger)';
    } else if (bottleneck.percentage >= 25) {
        panel.style.borderLeftColor = 'var(--warning)';
        panel.style.background = 'rgba(245, 158, 11, 0.03)';
        bar.style.backgroundColor = 'var(--warning)';
        pctText.style.color = 'var(--warning)';
    } else {
        panel.style.borderLeftColor = 'var(--info)';
        panel.style.background = 'rgba(59, 130, 246, 0.03)';
        bar.style.backgroundColor = 'var(--info)';
        pctText.style.color = 'var(--info)';
    }
}

function renderCharts(analytics) {
    // 1. Order stages chart
    const orderCtx = document.getElementById('order-stages-chart').getContext('2d');
    const backlogs = analytics.bottleneck.backlogs;
    
    const orderLabels = Object.keys(backlogs);
    const orderValues = Object.values(backlogs);
    
    if (orderChart) {
        orderChart.data.labels = orderLabels;
        orderChart.data.datasets[0].data = orderValues;
        orderChart.update();
    } else {
        orderChart = new Chart(orderCtx, {
            type: 'bar',
            data: {
                labels: orderLabels,
                datasets: [{
                    label: 'Orders in Stage',
                    data: orderValues,
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
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9CA3AF' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    x: {
                        ticks: { color: '#9CA3AF' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    // 2. Inventory Health Chart
    const invCtx = document.getElementById('inventory-health-chart').getContext('2d');
    const invData = [
        analytics.inventory_metrics.healthy,
        analytics.inventory_metrics.low_stock,
        analytics.inventory_metrics.out_of_stock,
        analytics.inventory_metrics.damaged
    ];
    
    if (inventoryChart) {
        inventoryChart.data.datasets[0].data = invData;
        inventoryChart.update();
    } else {
        inventoryChart = new Chart(invCtx, {
            type: 'doughnut',
            data: {
                labels: ['Healthy', 'Low Stock', 'Out of Stock', 'Damaged'],
                datasets: [{
                    data: invData,
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.6)', // Green
                        'rgba(245, 158, 11, 0.6)', // Yellow
                        'rgba(239, 68, 68, 0.6)',  // Red
                        'rgba(156, 163, 175, 0.6)' // Gray
                    ],
                    borderColor: [
                        '#10B981', '#F59E0B', '#EF4444', '#9CA3AF'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9CA3AF', boxWidth: 12 }
                    }
                },
                cutout: '65%'
            }
        });
    }
}
