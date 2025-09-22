# Model Governance Dashboard

A Flask-based web application for monitoring and managing ML model governance, compliance, and security scanning.

## Features

- **Model Governance Overview**: View registered models with governance bundles and policies
- **Risk Assessment**: Display significance, usage, and complexity risk levels
- **Compliance Tracking**: EU AI Act risk levels, security classifications, expiry dates
- **Security Scanning**: Integrated Semgrep-based security analysis for model artifacts
- **Real-time Monitoring**: Model health metrics and experiment tracking
- **Interactive Dashboard**: Expandable details, filtering, and search functionality

## Project Structure

```
├── app.py                 # Main Flask application
├── app.sh                 # Launch script
├── security_check.py      # Security scanning logic
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html         # Main dashboard template
├── static/
│   ├── css/
│   │   └── style.css      # Dashboard styling
│   └── js/
│       └── main.js        # Frontend application logic
└── README.md
```

## Installation

1. **Clone and setup environment**:
```bash
git clone <repository-url>
cd <project-directory>
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install dependencies**:
```bash
pip install -r requirements.txt
```

3. **Configure environment**:
Create `.env` file or export variables:
```bash
export DOMINO_API_BASE="https://your-domino-instance.com"
export DOMINO_API_KEY="your-api-key"
export PORT=8501
```

## Usage

### Development Server
```bash
PORT=8501 bash app.sh
```

### Production Deployment
```bash
gunicorn --bind 0.0.0.0:8501 app:app
```

Access the dashboard at `http://localhost:8501`

## API Endpoints

### Core Routes
- `GET /` - Main dashboard interface
- `GET /proxy/<path:path>` - Proxy requests to Domino API
- `POST /security-scan-model` - Trigger security scans

### Security Scanning
The application integrates with Semgrep for static code analysis:

```python
# Trigger scan via POST to /security-scan-model
{
    "modelName": "model-name",
    "version": "1.0",
    "fileRegex": ".*",
    "excludeRegex": "(node_modules|\\.git|\\.venv|__pycache__)",
    "semgrepConfig": "auto",
    "includeIssues": true
}
```

## Configuration

### Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `DOMINO_API_BASE` | Domino platform API base URL | Required |
| `DOMINO_API_KEY` | API authentication key | Required |
| `PORT` | Server port | 8501 |
| `FLASK_ENV` | Flask environment | production |

### Frontend Configuration
The JavaScript application automatically detects the proxy configuration and routes API calls through the Flask backend to avoid CORS issues.

## Data Flow

1. **Data Fetching**: Retrieves governance bundles, policies, and evidence from Domino API
2. **Data Processing**: Extracts model metadata, risk assessments, and compliance information
3. **Rendering**: Displays interactive table with expandable details
4. **Security Integration**: On-demand security scanning with result visualization

## Key Features

### Model Governance Table
- Model name and version information
- Application type and service levels
- Risk assessments (significance, usage, complexity)
- Compliance status (EU AI Act, security classification)
- Model health metrics

### Security Scanning
- Static code analysis using Semgrep
- Severity-based issue categorization (High/Medium/Low)
- File-level vulnerability reporting
- Configurable scan patterns and exclusions

### Interactive Features
- Real-time search and filtering
- Expandable row details
- Tab-based status filtering
- Responsive design

## Development

### Adding New Features
1. Backend routes in `app.py`
2. Security logic in `security_check.py`  
3. Frontend interactions in `static/js/main.js`
4. Styling in `static/css/style.css`

### API Integration
The app uses a proxy pattern to handle Domino API calls:
```javascript
// Frontend makes calls to local proxy
const response = await proxyFetch('api/governance/v1/bundles');

// Flask proxies to actual Domino instance
@app.route('/proxy/<path:path>')
def proxy_request(path):
    # Forwards to DOMINO_API_BASE with authentication
```

## Security Considerations

- API keys are handled server-side only
- Input validation on security scan parameters
- File pattern restrictions for security scanning
- CORS handling through proxy architecture

## Troubleshooting

### Common Issues
1. **API Connection**: Verify `DOMINO_API_BASE` and `DOMINO_API_KEY`
2. **Port Conflicts**: Change `PORT` environment variable
3. **Missing Data**: Check Domino instance connectivity and permissions
4. **Security Scans Failing**: Ensure Semgrep is properly installed

### Debug Mode
```bash
FLASK_ENV=development python app.py
```

## License

[Add your license information here]

## Contributing

[Add contribution guidelines here]
