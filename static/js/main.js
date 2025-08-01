// Domino API Configuration
const DOMINO_API_BASE = window.location.origin;
const API_KEY = '428e2d4b8ee635aa3bf9fd93975aedc8eef4d848707d72c8dfca538e7434b3de';
const PROJECT_ID = DOMINO_PROJECT_ID || '';

console.log('Initialized with Project ID:', PROJECT_ID);

// Simple, clean API call - if it fails, it fails
async function fetchCurrentUser() {
    try {
        console.log('Calling Domino API:', `${DOMINO_API_BASE}/api/users/v1/self`);
        
        const response = await fetch(`${DOMINO_API_BASE}/api/users/v1/self`, {
            method: 'GET',
            headers: {
                'X-Domino-Api-Key': API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const userData = await response.json();
        console.log('Domino User Data:', userData);
        return userData;
        
    } catch (error) {
        console.log('API call failed (expected due to CORS):', error.message);
        console.log('Dashboard will continue without user data');
        return null;
    }
}

// Fetch all registered models visible to the user
async function fetchUserModels() {
    try {
        console.log('Fetching registered models from Domino API...');
        
        const response = await fetch(`${DOMINO_API_BASE}/api/registeredmodels/v1/ui?maxResults=120`, {
            method: 'GET',
            headers: {
                'X-Domino-Api-Key': API_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }

        const modelsData = await response.json();
        console.log('Registered models visible to user:', modelsData);
        console.log('Total models found:', modelsData.items?.length || 0);
        
        // Filter for models that have the demo tag set to true
        const models = modelsData.items?.filter(model => {
            const tags = model.tags || {};
            return tags.model_dashboard_demo === 'true';
        }) || [];
        console.log('Demo models found:', models);

        return models;
        
    } catch (error) {
        console.log('Registered models API call failed:', error.message);
        return null;
    }
}

// Initialize dashboard
async function initializeDashboard() {
    console.log('Initializing Model Management Dashboard...');
    
    // Try to fetch user data - if it fails, continue anyway
    const userData = await fetchCurrentUser();
    
    if (userData && userData.user) {
        console.log('Successfully loaded user:', userData.user.userName);
    }
    
    // Fetch all models visible to the user
    const models = await fetchUserModels();
    if (models && models.length > 0) {
        populateModelsTable(models);
    } else {
        showNoModelsMessage();
    }
    
    console.log('Dashboard ready');
}

// Function to populate the table with model data
function populateModelsTable(models) {
    const tbody = document.querySelector('.table-container tbody');
    tbody.innerHTML = ''; // Clear existing content
    
    models.forEach((model, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="model-name">${model.name || 'Unnamed Model'}</div>
                <div class="model-type">${model.type || 'Unknown Type'}</div>
            </td>
            <td>
                <div class="user-info">
                    <div class="user-avatar">${getInitials(model.owner?.userName || 'Unknown')}</div>
                    <span class="user-name">${model.owner?.userName || 'Unknown'}</span>
                </div>
            </td>
            <td>
                <span class="status-badge status-${(model.status || 'development').toLowerCase()}">${model.status || 'Development'}</span>
            </td>
            <td>
                <span class="risk-badge" title="${getRiskTooltip(model.riskClass)}">${model.riskClass || 'P3'}</span>
            </td>
            <td>
                <div class="dev-items">
                    ${model.activeDevelopment ? '<span class="dev-item">Active</span>' : '<span class="dev-item">None</span>'}
                </div>
            </td>
            <td>
                <div class="findings">
                    ${getFindings(model.findings)}
                </div>
            </td>
            <td>
                <div class="dependencies">
                    ${getDependencies(model.dependencies)}
                </div>
            </td>
            <td>
                ${model.externalAccess ? '<span class="metric-value metric-positive">Enabled</span>' : '<span class="metric-value metric-neutral">Disabled</span>'}
            </td>
            <td>
                <span class="metric-value">${model.health || '98.5'}%</span>
            </td>
            <td>${getLastRunTime(model.lastRun)}</td>
            <td>
                <button class="action-btn" onclick="toggleRow(this, 'details-${index}')">
                    <span>Details</span>
                    <span class="arrow">▼</span>
                </button>
            </td>
        `;
        
        // Add expandable details row
        const detailsRow = document.createElement('tr');
        detailsRow.id = 'details-' + index;
        detailsRow.className = 'expandable-row';
        detailsRow.innerHTML = `
            <td colspan="11">
                <div class="expandable-content">
                    <div class="detail-section">
                        <h3 class="section-title">Model Details</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">Version</div>
                                <div class="detail-value">${model.version || '1.0.0'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Created</div>
                                <div class="detail-value">${formatDate(model.createdAt)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="actions-row">
                        <button class="btn btn-primary">View Model</button>
                        <button class="btn btn-secondary">Edit Settings</button>
                        ${model.status !== 'Production' ? '<button class="btn btn-secondary">Approve for Production</button>' : ''}
                        ${hasFindings(model.findings) ? '<button class="btn btn-danger">Escalate Findings</button>' : ''}
                    </div>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
        tbody.appendChild(detailsRow);
    });
}

// Helper functions for table generation
function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
}

function getRiskTooltip(riskClass) {
    const tooltips = {
        'P0': 'Critical Priority - Regulatory/Business Critical',
        'P1': 'High Priority - Material Risk Impact',
        'P2': 'Medium Priority - Moderate Risk Impact',
        'P3': 'Low Priority - Low Risk Impact',
        'P4': 'Minimal Priority - Monitoring/Research'
    };
    return tooltips[riskClass] || tooltips.P3;
}

function getFindings(findings = []) {
    if (!findings || findings.length === 0) {
        return '<span class="no-findings">No Findings</span>';
    }
    return findings.map(f => `
        <div class="finding-item ${f.severity.toLowerCase()}">
            <span class="finding-text">${f.description}</span>
            <span class="finding-age">${f.age}d</span>
        </div>
    `).join('');
}

function getDependencies(deps = []) {
    if (!deps || deps.length === 0) {
        return 'None';
    }
    return deps.map(d => `
        <span class="dependency-item ${d.status}">${d.name}</span>
    `).join('');
}

function getLastRunTime(timestamp) {
    if (!timestamp) return 'Never';
    // Simple mock for now
    return '5 min ago';
}

function formatDate(date) {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
}

function hasFindings(findings) {
    return findings && findings.length > 0;
}

function showNoModelsMessage() {
    const tbody = document.querySelector('.table-container tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="11" style="text-align: center; padding: 40px;">
                No models found in this project
            </td>
        </tr>
    `;
}

// Call initialization when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

function toggleRow(button, rowId) {
    const row = document.getElementById(rowId);
    const arrow = button.querySelector('.arrow');
    
    if (row.classList.contains('show')) {
        row.classList.remove('show');
        arrow.classList.remove('rotated');
        button.classList.remove('expanded');
        button.querySelector('span').textContent = 'Details';
    } else {
        // Close other expanded rows
        document.querySelectorAll('.expandable-row.show').forEach(r => {
            r.classList.remove('show');
        });
        document.querySelectorAll('.arrow.rotated').forEach(a => {
            a.classList.remove('rotated');
        });
        document.querySelectorAll('.action-btn.expanded').forEach(b => {
            b.classList.remove('expanded');
            b.querySelector('span').textContent = 'Details';
        });
        
        // Open clicked row
        row.classList.add('show');
        arrow.classList.add('rotated');
        button.classList.add('expanded');
        button.querySelector('span').textContent = 'Close';
    }
}

// Tab functionality
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
});

// Action button functionality
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn')) {
        const action = e.target.textContent;
        if (action.includes('Emergency') || action.includes('Stop') || action.includes('Escalate')) {
            if (confirm(`Are you sure you want to ${action.toLowerCase()}? This requires manager approval.`)) {
                alert(`${action} initiated. Risk management team and compliance have been notified.`);
            }
        } else if (action.includes('Approve')) {
            if (confirm(`Approve this model for production? This will update the model status.`)) {
                alert(`Model approved. Moving to production deployment queue.`);
            }
        } else {
            alert(`Opening ${action} interface...`);
        }
    }
});

// Simulate real-time updates for model health
setInterval(() => {
    const healthMetrics = document.querySelectorAll('.metric-value');
    healthMetrics.forEach(metric => {
        if (metric.textContent.includes('%') && !metric.textContent.includes('Failed')) {
            const currentValue = parseFloat(metric.textContent);
            const variation = (Math.random() - 0.5) * 0.2; // ±0.1% variation
            const newValue = Math.max(85, Math.min(100, currentValue + variation));
            metric.textContent = newValue.toFixed(1) + '%';
        }
    });
}, 30000); // Update every 30 seconds

// Simulate live updates for "Last Run" timestamps
function updateTimestamps() {
    const timestamps = document.querySelectorAll('td:nth-child(9)');
    timestamps.forEach(cell => {
        const text = cell.textContent.trim();
        if (text.includes('min ago')) {
            const minutes = parseInt(text);
            if (!isNaN(minutes)) {
                cell.textContent = `${minutes + 1} min ago`;
            }
        } else if (text.includes('hour ago') || text.includes('hours ago')) {
            // Convert to minutes for more granular updates
            const hours = parseInt(text);
            if (!isNaN(hours) && hours === 1) {
                cell.textContent = '61 min ago';
            }
        }
    });
}

// Update timestamps every minute
setInterval(updateTimestamps, 60000);

// Filter functionality for tabs including findings
function filterByStatus(status) {
    const rows = document.querySelectorAll('tbody tr:not(.expandable-row)');
    rows.forEach(row => {
        const statusCell = row.querySelector('.status-badge');
        const findingsCell = row.querySelector('.findings');
        
        if (status === 'all') {
            row.style.display = '';
        } else if (status === 'critical findings') {
            // Show rows with critical or overdue findings
            const hasCriticalFindings = findingsCell && (
                findingsCell.querySelector('.finding-item.critical') ||
                findingsCell.querySelector('.finding-age.overdue')
            );
            row.style.display = hasCriticalFindings ? '' : 'none';
        } else if (statusCell.textContent.toLowerCase().includes(status.toLowerCase())) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Add click handlers for filter tabs
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Get filter value from data attribute
        const filterValue = this.getAttribute('data-filter');
        filterByStatus(filterValue);
    });
});

// Findings aging update
function updateFindingsAging() {
    const findingAges = document.querySelectorAll('.finding-age');
    findingAges.forEach(ageElement => {
        if (!ageElement.classList.contains('overdue') && !ageElement.classList.contains('warning')) {
            const currentAge = parseInt(ageElement.textContent);
            if (!isNaN(currentAge)) {
                const newAge = currentAge + 1;
                ageElement.textContent = `${newAge}d`;
                
                // Update styling based on age
                if (newAge > 30) {
                    ageElement.className = 'finding-age overdue';
                } else if (newAge > 20) {
                    ageElement.className = 'finding-age warning';
                }
            }
        }
    });
}

// Update findings aging daily (simulated as every 30 seconds for demo)
setInterval(updateFindingsAging, 30000);

// Findings alert system
function checkCriticalFindings() {
    const overdueFindings = document.querySelectorAll('.finding-age.overdue');
    const criticalFindings = document.querySelectorAll('.finding-item.critical');
    
    if (overdueFindings.length > 0 || criticalFindings.length > 0) {
        // Update notification icon
        const notificationIcon = document.querySelector('.notification-icon');
        if (notificationIcon) {
            notificationIcon.style.animation = 'pulse 1s infinite';
        }
        
        // Console log for demo (in real app, this would trigger alerts)
        console.log(`Alert: ${overdueFindings.length} overdue findings, ${criticalFindings.length} critical findings`);
    }
}

// Check for critical findings on load
checkCriticalFindings();

// Enhanced action button functionality for findings
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn')) {
        const action = e.target.textContent;
        if (action.includes('Escalate Findings') || action.includes('Escalate All Findings')) {
            if (confirm(`Escalate findings to senior management? This will trigger immediate review and notification to CRO.`)) {
                alert(`Findings escalated. Senior management and CRO have been notified. Expect response within 2 hours.`);
            }
        } else if (action.includes('Emergency') || action.includes('Stop') || action.includes('Escalate')) {
            if (confirm(`Are you sure you want to ${action.toLowerCase()}? This requires manager approval.`)) {
                alert(`${action} initiated. Risk management team and compliance have been notified.`);
            }
        } else if (action.includes('Approve')) {
            if (confirm(`Approve this model for production? This will update the model status.`)) {
                alert(`Model approved. Moving to production deployment queue.`);
            }
        } else {
            alert(`Opening ${action} interface...`);
        }
    }
});

// Search functionality
const searchBox = document.querySelector('.search-box');
if (searchBox) {
    searchBox.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('tbody tr:not(.expandable-row)');
        
        rows.forEach(row => {
            const modelName = row.querySelector('.model-name').textContent.toLowerCase();
            const ownerName = row.querySelector('.user-name').textContent.toLowerCase();
            const modelType = row.querySelector('.model-type').textContent.toLowerCase();
            
            if (modelName.includes(searchTerm) || 
                ownerName.includes(searchTerm) || 
                modelType.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}


// Add tooltips for risk badges
document.querySelectorAll('.risk-badge').forEach(badge => {
    const riskLevel = badge.textContent;
    let tooltip = '';
    
    switch(riskLevel) {
        case 'P0':
            tooltip = 'Critical Priority - Regulatory/Business Critical';
            break;
        case 'P1':
            tooltip = 'High Priority - Material Risk Impact';
            break;
        case 'P2':
            tooltip = 'Medium Priority - Moderate Risk Impact';
            break;
        case 'P3':
            tooltip = 'Low Priority - Low Risk Impact';
            break;
        case 'P4':
            tooltip = 'Minimal Priority - Monitoring/Research';
            break;
    }
    
    badge.title = tooltip;
});

// Model health status indicators
function updateHealthIndicators() {
    const healthMetrics = document.querySelectorAll('.metric-value');
    healthMetrics.forEach(metric => {
        const text = metric.textContent;
        if (text.includes('%')) {
            const value = parseFloat(text);
            if (value >= 95) {
                metric.className = 'metric-value metric-positive';
            } else if (value >= 85) {
                metric.className = 'metric-value metric-neutral';
            } else {
                metric.className = 'metric-value metric-negative';
            }
        }
    });
}

// Run health indicator update on load
updateHealthIndicators();
