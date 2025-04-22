# LLM Dashboard Integration

This document describes the LLM dashboard implementation for visualizing metrics about LLM usage on the website. The dashboard supports both LangSmith API-based metrics and local metrics tracking.

## Overview

The dashboard provides insights about LLM usage in the vulnerability post generator, including:

1. Total runs and average processing time
2. Token usage statistics and estimated costs
3. Model performance comparisons
4. Historical trends
5. Recent run details

## Data Sources

The dashboard supports two data sources:

1. **LangSmith API** - When connected to LangSmith, the dashboard fetches data from the LangSmith API
2. **Local Metrics** - When LangSmith is not available, the dashboard uses locally tracked metrics

## Architecture

The dashboard implementation consists of several components:

1. **Data Collection** 
   - LangSmith API integration that fetches metrics when available
   - Local metrics logger that tracks LLM usage without requiring external APIs

2. **Data Storage**
   - JSON files stored in the website's asset directory
   - Fallback caching mechanisms to ensure data availability

3. **Visualization**
   - Interactive charts and tables on the dashboard page
   - Dynamic data source indication

4. **Automated Updates**
   - GitHub Actions workflow for regular data refreshes
   - Integration with LLM client for metrics collection

## Implementation Details

### Data Flow

#### LangSmith API Flow
1. The `src/api/langsmith-api.js` module fetches data from LangSmith API
2. Data is processed and saved to `src/_data/core/langsmith-data.json`
3. The `ensure-dashboard-data.js` script copies this data to the public assets directory
4. The dashboard page loads this data via fetch and renders visualizations

#### Local Metrics Flow
1. The `src/utils/metrics-logger.js` module logs metrics for each LLM interaction
2. Metrics are stored in `src/_data/core/llm-metrics.json`
3. When the API tries to fetch data but LangSmith is unavailable, it falls back to these local metrics
4. The dashboard displays the local metrics with a data source indicator

### Key Components

- **LangSmith API Client** - Handles authentication and data retrieval from LangSmith
- **Metrics Logger** - Tracks LLM usage metrics locally without requiring external services
- **Dashboard Page** - Uses Chart.js for visualization with dynamic data source handling
- **Update Scripts** - Automate the process of refreshing dashboard data
- **Fallback Mechanisms** - Provide cached data when primary data sources are unavailable

## Usage

### Viewing the Dashboard

The dashboard is accessible at `/dashboard/` on the website.

### Running Manual Updates

To update the dashboard data manually:

```bash
# Update data from LangSmith
npm run dashboard:update

# Ensure data is copied to public assets
npm run dashboard:ensure

# Build the site with updated dashboard data
npm run build:with-dashboard
```

### Environment Variables

The dashboard supports the following environment variables:

#### LangSmith Integration (Optional)
- `LANGSMITH_API_KEY` - Your LangSmith API key
- `LANGSMITH_PROJECT` - The LangSmith project name (default: vuln-post-generator)
- `ENABLE_TRACING` - Set to 'true' to enable LangSmith tracing

#### Local Metrics (Always Available)
Local metrics are collected automatically without requiring environment variables. The system will fall back to local metrics when LangSmith is not available.

## GitHub Actions Integration

A GitHub Action (`update-dashboard.yml`) automatically updates the dashboard data every 6 hours. This ensures the dashboard always displays current information without manual intervention.

## Extending the Dashboard

To add new metrics or visualizations:

1. Update `langsmith-api.js` to fetch and process the additional data
2. Modify `dashboard/index.njk` to add new chart or data display
3. Add any necessary JavaScript to render new visualizations

## Troubleshooting

If the dashboard isn't displaying data:

1. Check that LangSmith API credentials are valid
2. Verify that `langsmith-data.json` exists in both source and assets directories
3. Look for errors in the browser console
4. Run `npm run dashboard:update` to manually refresh data

## Security Considerations

- The LangSmith API key is stored as a GitHub secret
- No sensitive data is displayed on the dashboard
- Only aggregated metrics are made public