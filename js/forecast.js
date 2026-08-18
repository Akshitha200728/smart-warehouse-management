let forecastChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadForecast();
});

async function loadForecast() {
    try {
        const forecasts = await fetchAPI('/inventory/forecast', { method: 'GET' });
        renderKPIs(forecasts);
        renderForecastTable(forecasts);
        renderForecastChart(forecasts);
    } catch (e) {
        console.error(e);
    }
}

function renderKPIs(forecasts) {
    const stockedOut = forecasts.filter(f => f.available_stock === 0).length;
    const critical = forecasts.filter(f => f.risk_level === 'Critical Risk').length;
    const high = forecasts.filter(f => f.risk_level === 'High Risk').length;
    
    document.getElementById('kpi-stockouts').textContent = stockedOut;
    document.getElementById('kpi-critical').textContent = critical;
    document.getElementById('kpi-high').textContent = high;
}

function renderForecastTable(forecasts) {
    const tbody = document.querySelector('#forecast-table tbody');
    tbody.innerHTML = '';
    
    if (forecasts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px 0;">No forecasting metrics available.</td></tr>`;
        return;
    }
    
    forecasts.forEach(f => {
        const tr = document.createElement('tr');
        
        let riskBadge = '';
        let riskClass = '';
        if (f.risk_level === 'Stocked Out') {
            riskBadge = 'Stocked Out';
            riskClass = 'risk-critical';
        } else if (f.risk_level === 'Critical Risk') {
            riskBadge = 'Critical Risk';
            riskClass = 'risk-critical';
        } else if (f.risk_level === 'High Risk') {
            riskBadge = 'High Risk';
            riskClass = 'risk-high';
        } else if (f.risk_level === 'Medium Risk') {
            riskBadge = 'Medium Risk';
            riskClass = 'risk-medium';
        } else {
            riskBadge = 'Low Risk';
            riskClass = 'risk-low';
        }
        
        let actionBtn = '';
        if (f.risk_level !== 'Low Risk') {
            // Suggest replenishment reorder quantity
            const recQty = Math.max(10, Math.ceil((f.avg_daily_demand * f.lead_time) + f.safety_stock - f.available_stock));
            actionBtn = `
                <button class="btn btn-primary btn-sm" onclick="triggerRestock('${f.product_id}', ${recQty})" style="padding: 2px 8px; font-size:11px;">
                    <i class="fas fa-shopping-basket"></i> Restock ${recQty}
                </button>
            `;
        } else {
            actionBtn = `<span style="color:var(--success); font-size:12px;"><i class="fas fa-check-circle"></i> Secure</span>`;
        }
        
        const runoutText = f.days_to_stockout === 999.0 ? '∞' : `${f.days_to_stockout} days`;
        
        tr.innerHTML = `
            <td style="font-weight: 600;">${f.name}</td>
            <td>${f.sku}</td>
            <td><span style="font-family: monospace; color: var(--primary);">${f.location}</span></td>
            <td style="font-weight: 700;">${f.available_stock}</td>
            <td>${f.avg_daily_demand}/day</td>
            <td>${f.lead_time} days</td>
            <td style="font-weight: 700; color: ${f.days_to_stockout < f.lead_time ? 'var(--danger)' : 'var(--text-primary)'};">${runoutText}</td>
            <td><span class="badge ${riskClass}" style="font-size: 11px;">${riskBadge}</span></td>
            <td>${actionBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderForecastChart(forecasts) {
    // Only chart items at risk
    const atRiskItems = forecasts.filter(f => f.risk_level !== 'Low Risk').slice(0, 5);
    
    const ctx = document.getElementById('forecast-chart').getContext('2d');
    
    const labels = atRiskItems.map(f => f.sku);
    const runoutDays = atRiskItems.map(f => f.days_to_stockout === 999.0 ? 0 : f.days_to_stockout);
    const leadTimes = atRiskItems.map(f => f.lead_time);
    
    if (forecastChart) {
        forecastChart.destroy();
    }
    
    forecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Days to Runout',
                    data: runoutDays,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: '#EF4444',
                    borderWidth: 1
                },
                {
                    label: 'Supplier Lead Time',
                    data: leadTimes,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3B82F6',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9CA3AF', font: { family: 'Outfit', size: 11 } }
                }
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

async function triggerRestock(prodId, qty) {
    const currentUser = JSON.parse(localStorage.getItem('smartfulfill_user') || '{}');
    try {
        const res = await fetchAPI(`/products/${prodId}`, {
            method: 'PUT',
            body: {
                action: 'adjustment',
                adjustment: qty,
                user: currentUser.name || 'Alex Carter'
            }
        });
        
        if (res.success) {
            showToast(`Replenishment order of ${qty} units processed successfully.`, 'success');
            loadForecast();
        }
    } catch (e) {
        console.error(e);
    }
}
