let volumeChart = null;
let delayChart = null;
let healthChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();
    
    // Refresh every 30 seconds
    setInterval(loadAnalytics, 30000);
});

async function loadAnalytics() {
    try {
        const data = await fetchAPI('/analytics', { method: 'GET' });
        renderStats(data);
        renderCharts(data);
    } catch (e) {
        console.error(e);
    }
}

function renderStats(data) {
    document.getElementById('stat-avg-pick').textContent = `${data.warehouse_metrics.avg_picking_mins} mins`;
    document.getElementById('stat-avg-pack').textContent = `${data.warehouse_metrics.avg_packing_mins} mins`;
    document.getElementById('stat-avg-cycle').textContent = `${data.warehouse_metrics.avg_fulfillment_mins} mins`;
    document.getElementById('stat-orders-hr').textContent = data.warehouse_metrics.orders_per_hour;
    
    document.getElementById('analytics-bottleneck-title').textContent = data.bottleneck.stage;
    document.getElementById('analytics-bottleneck-recom').textContent = data.bottleneck.recommendation;
}

function renderCharts(data) {
    const oM = data.order_metrics;
    const iM = data.inventory_metrics;
    const backlogs = data.bottleneck.backlogs;
    
    // 1. Volume Outcomes Chart (Completed vs Delayed vs Cancelled vs Active)
    const active = oM.total - (oM.completed + oM.cancelled);
    const volumeCtx = document.getElementById('fulfillment-volume-chart').getContext('2d');
    
    if (volumeChart) {
        volumeChart.data.datasets[0].data = [oM.completed, oM.delayed, oM.cancelled, active];
        volumeChart.update();
    } else {
        volumeChart = new Chart(volumeCtx, {
            type: 'pie',
            data: {
                labels: ['Completed', 'Delayed', 'Cancelled', 'In Progress'],
                datasets: [{
                    data: [oM.completed, oM.delayed, oM.cancelled, active],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.6)', // Green
                        'rgba(239, 68, 68, 0.6)',  // Red
                        'rgba(107, 114, 128, 0.6)', // Gray
                        'rgba(59, 130, 246, 0.6)'  // Blue
                    ],
                    borderColor: ['#10B981', '#EF4444', '#6B7280', '#3B82F6'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9CA3AF', boxWidth: 12, font: { family: 'Outfit' } }
                    }
                }
            }
        });
    }
    
    // 2. Stage Delay Contribution Chart
    const delayCtx = document.getElementById('delay-contribution-chart').getContext('2d');
    const delayLabels = Object.keys(backlogs);
    const delayValues = Object.values(backlogs);
    
    if (delayChart) {
        delayChart.data.labels = delayLabels;
        delayChart.data.datasets[0].data = delayValues;
        delayChart.update();
    } else {
        delayChart = new Chart(delayCtx, {
            type: 'doughnut',
            data: {
                labels: delayLabels,
                datasets: [{
                    data: delayValues,
                    backgroundColor: [
                        'rgba(249, 115, 22, 0.6)', // Orange
                        'rgba(59, 130, 246, 0.6)', // Blue
                        'rgba(245, 158, 11, 0.6)', // Yellow
                        'rgba(167, 139, 250, 0.6)', // Purple
                        'rgba(16, 185, 129, 0.6)'  // Green
                    ],
                    borderColor: ['#F97316', '#3B82F6', '#F59E0B', '#A78BFA', '#10B981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#9CA3AF', boxWidth: 12, font: { family: 'Outfit' } }
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    // 3. Stock Health Chart (Healthy, Low Stock, Out of Stock, Damaged)
    const healthCtx = document.getElementById('stock-health-chart').getContext('2d');
    
    if (healthChart) {
        healthChart.data.datasets[0].data = [iM.healthy, iM.low_stock, iM.out_of_stock, iM.damaged];
        healthChart.update();
    } else {
        healthChart = new Chart(healthCtx, {
            type: 'bar',
            data: {
                labels: ['Healthy', 'Low Stock', 'Out of Stock', 'Damaged'],
                datasets: [{
                    label: 'SKU Count',
                    data: [iM.healthy, iM.low_stock, iM.out_of_stock, iM.damaged],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.6)',
                        'rgba(245, 158, 11, 0.6)',
                        'rgba(239, 68, 68, 0.6)',
                        'rgba(156, 163, 175, 0.6)'
                    ],
                    borderColor: ['#10B981', '#F59E0B', '#EF4444', '#9CA3AF'],
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y', // Makes it horizontal
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { color: '#9CA3AF' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#9CA3AF' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}
