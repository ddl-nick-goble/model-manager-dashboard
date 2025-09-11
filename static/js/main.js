// Domino API Configuration
const DOMINO_API_BASE = window.location.origin;
const API_KEY = '914d81ea8309f1dcb03ec63a4df82c66adad7fb9e5fbf6f24831fe7b59c7ab0b';
const PROJECT_ID = typeof DOMINO_PROJECT_ID !== 'undefined' ? DOMINO_PROJECT_ID : '';

// State for bundles API result
window.dominoBundles = null;

// Fetch bundles from Domino Governance API and log the result
async function fetchDominoBundles() {
    try {
        // Use the same host as the current page
        const url = `${window.location.origin}/api/governance/v1/bundles`;
        console.log('Fetching Domino Governance Bundles:', url);
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Domino-Api-Key': API_KEY,
                'accept': 'application/json'
            }
        });
        if (!response.ok) {
            throw new Error(`Bundles API returned ${response.status}: ${response.statusText}`);
        }
        const bundlesData = await response.json();
        // Filter bundles: must have at least one policy whose name contains 'fitch' (case-insensitive) AND not archived
        let filteredBundles = [];
        if (bundlesData && Array.isArray(bundlesData.data)) {
            filteredBundles = bundlesData.data.filter(bundle => {
                if (bundle.state === 'Archived') return false;
                if (!Array.isArray(bundle.policies)) return false;
                return bundle.policies.some(policy =>
                    typeof policy.policyName === 'string' &&
                    policy.policyName.toLowerCase().includes('[fitch')
                );
            });
            // Object keyed by bundle id for O(1) lookup
            window.dominoBundlesById = {};
            filteredBundles.forEach(bundle => {
                if (bundle.id) {
                    window.dominoBundlesById[bundle.id] = bundle;
                }
            });
        } else {
            window.dominoBundlesById = {};
        }
        // Replace bundlesData.data with filteredBundles
        const filteredBundlesData = { ...bundlesData, data: filteredBundles };
        window.dominoBundles = filteredBundlesData;

        // Fetch evidence for each bundle and store by bundle id
        window.dominoEvidenceByBundleId = {};
        const evidencePromises = filteredBundles.map(async bundle => {
            try {
                const evidenceUrl = `https://se-demo.domino.tech/api/governance/v1/drafts/latest?bundleId=${bundle.id}`;
                const response = await fetch(evidenceUrl, {
                    method: 'GET',
                    headers: {
                        'X-Domino-Api-Key': API_KEY,
                        'accept': 'application/json'
                    }
                });
                if (response.ok) {
                    const evidence = await response.json();
                    window.dominoEvidenceByBundleId[bundle.id] = evidence;
                } else {
                    // Log error details for failed evidence fetch
                    console.error(`Evidence API failed for bundleId ${bundle.id}: ${response.status} ${response.statusText}`);
                    window.dominoEvidenceByBundleId[bundle.id] = { error: true, status: response.status, statusText: response.statusText };
                }
            } catch (err) {
                // Log network or unexpected errors
                console.error(`Evidence API error for bundleId ${bundle.id}:`, err);
                window.dominoEvidenceByBundleId[bundle.id] = { error: true, message: err.message };
            }
        });
        await Promise.all(evidencePromises);

        // Log the filtered JSON result, lookup object, and evidence
        console.log('Domino Governance Bundles API result:', filteredBundlesData);
        console.log('Bundles keyed by id:', window.dominoBundlesById);
        console.log('Evidence by bundle id:', window.dominoEvidenceByBundleId);
        return filteredBundlesData;
    } catch (error) {
        console.log('Bundles API call failed:', error.message);
        window.dominoBundles = null;
        return null;
    }
}

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

// Initialize dashboard
async function initializeDashboard() {
    console.log('Initializing Model Management Dashboard...');

    // Show loading spinner for bundles (optional)
    const tbody = document.querySelector('.table-container tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 40px;"><div class="spinner" style="display: inline-block;"><svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;"><circle cx="24" cy="24" r="20" stroke="#543FDD" stroke-width="4" opacity="0.2"/><path d="M44 24c0-11.046-8.954-20-20-20" stroke="#543FDD" stroke-width="4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1s" repeatCount="indefinite"/></path></svg><div style="margin-top: 12px; color: #543FDD; font-size: 18px; font-weight: 500;">Loading bundles…</div></div></td></tr>`;
    }

    // Fetch Domino Governance Bundles on page load
    await fetchDominoBundles();

    // Try to fetch user data - if it fails, continue anyway
    const userData = await fetchCurrentUser();

    if (userData && userData.user) {
        console.log('Successfully loaded user:', userData.user.userName);
    }

    // Build table rows: one per bundle (key in evidence by bundle id)
    const tableRows = [];
    for (const bundleId in window.dominoEvidenceByBundleId) {
        const evidence = window.dominoEvidenceByBundleId[bundleId];
        const bundle = window.dominoBundlesById[bundleId];
        let item = null;
        if (Array.isArray(evidence) && evidence.length > 0) {
            item = evidence[0]; // Use first evidence item
        }
        if (item) {
            tableRows.push({
                modelName: item.artifactContent && typeof item.artifactContent === 'string' ? item.artifactContent : Array.isArray(item.artifactContent) ? item.artifactContent.join(', ') : '[Unknown]',
                modelVersion: item.updatedAt || '-',
                bundleName: bundle?.name || 'Unknown Bundle',
                bundleId: bundleId,
                evidenceStatus: item.evidenceId || '-',
                evidenceCreated: item.updatedAt || '-',
                modelType: '-',
                owner: item.userId || null,
                status: '-',
                riskClass: '-',
                activeDevelopment: false,
                findings: [],
                dependencies: [],
                externalAccess: false,
                health: '-',
                lastRun: null,
                createdAt: null
            });
        } else if (evidence && evidence.error) {
            tableRows.push({
                modelName: '[Evidence Error]',
                modelVersion: '-',
                bundleName: bundle?.name || 'Unknown Bundle',
                bundleId: bundleId,
                evidenceStatus: evidence.statusText || evidence.message || 'Error',
                evidenceCreated: null,
                modelType: '-',
                owner: null,
                status: '-',
                riskClass: '-',
                activeDevelopment: false,
                findings: [],
                dependencies: [],
                externalAccess: false,
                health: '-',
                lastRun: null,
                createdAt: null
            });
        }
    }
    if (tableRows.length > 0) {
        populateModelsTable(tableRows);
    } else {
        const tbody2 = document.querySelector('.table-container tbody');
        if (tbody2) {
            tbody2.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 40px; color: #888; font-size: 18px; font-weight: 500;">No models or bundles to display</td></tr>`;
        }
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


function showLoadingSpinner() {
    const tbody = document.querySelector('.table-container tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="12" style="text-align: center; padding: 40px;">
                <div class="spinner" style="display: inline-block;">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                        <circle cx="24" cy="24" r="20" stroke="#543FDD" stroke-width="4" opacity="0.2"/>
                        <path d="M44 24c0-11.046-8.954-20-20-20" stroke="#543FDD" stroke-width="4" stroke-linecap="round">
                            <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="1s" repeatCount="indefinite"/>
                        </path>
                    </svg>
                    <div style="margin-top: 12px; color: #543FDD; font-size: 18px; font-weight: 500;">Loading models…</div>
                </div>
            </td>
        </tr>
    `;
}

function showNoModelsMessage() {
    const tbody = document.querySelector('.table-container tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="12" style="text-align: center; padding: 40px; color: #888; font-size: 18px; font-weight: 500;">
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
