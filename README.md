# UIRP_Research_Hackathon

# UniTion - Notion Assignment Integration

## Contributors
- Isabella Chou
- Roshni Dave  
- Naavya Shetty

## About
UniTion is a Chrome extension that automatically scrapes assignment data from course websites and integrates it directly into Notion as a to-do list with class tags.

## Features

### 🆕 NEW: Notion Integration
- **Direct Notion Integration**: Assignment data is sent directly to Notion databases
- **Overlay UI**: Notifications appear as overlays on Notion pages
- **Class Tags**: Assignments are organized by class using Notion multi-select tags
- **To-Do Style**: All assignments are added as checkboxes for easy tracking

### 📚 Assignment Data Structure
Each assignment includes:
- **Assignment Name** (Title)
- **Due Date** (Date)
- **Due Time** (Text)
- **Class** (Multi-select tag)
- **Details** (Rich text)
- **Done** (Checkbox)

## Setup Instructions

### 1. Install the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `UIRP_Research_Hackathon` folder

### 2. Configure Notion Integration
1. Create a Notion integration at [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Copy your integration token (starts with `ntn_`)
3. Click the UniTion extension icon
4. Enter your Notion integration token
5. (Optional) Enter a database ID if you want to use an existing database
6. Click "Save Configuration" and "Test Connection"

### 3. Create Notion Database
The extension will create a database with the following structure:
- **Assignment Name**: Title property
- **Due Date**: Date property  
- **Due Time**: Rich text property
- **Class**: Multi-select property (for class tags)
- **Details**: Rich text property
- **Done**: Checkbox property

## How It Works

### Flow Logic
1. **Scraper collects data** from course websites (external to this extension)
2. **Data is sent** to the Chrome extension
3. **Background script** receives the assignment data
4. **Content script** injects overlay UI on Notion pages
5. **User sees preview** and can confirm adding to Notion
6. **Assignment is added** to the configured Notion database
7. **Success notification** appears on the Notion page

### File Structure
```
UIRP_Research_Hackathon/
├── manifest.json              # Extension configuration
├── popup.js                   # Popup UI with Notion config
├── background.js              # Notion API integration
├── contentScript.js           # Notion page overlay
├── overlay.css                # Overlay styling
├── sample_assignments.json    # Sample data for testing
├── test_scraper.js           # Test functions
├── index.html                # Popup HTML
├── styles.css                # Popup styling
└── images/                   # Extension icons
```

## Testing

### Test Scraper Data
1. Open the extension popup
2. Go to the "Test Scraper Data" section
3. Click "Test Sample Data" to send a test assignment
4. Click "Test Random Assignment" to send a random assignment from the sample data
5. Check your Notion page for the new assignment

### Sample Data
The `sample_assignments.json` file contains 10 sample assignments across different classes:
- Physics 202
- Math 301  
- Computer Science 450
- Chemistry 201
- English 220
- Economics 101
- Art History 150
- Statistics 200

## Technical Details

### Notion API Integration
- Uses Notion API v1
- Requires integration token for authentication
- Creates assignments as pages in the specified database
- Uses multi-select tags for class organization

### Chrome Extension Architecture
- **Manifest V3** compliant
- **Content scripts** for Notion page injection
- **Background service worker** for API calls
- **Popup** for configuration
- **Chrome storage** for token persistence

### Message Flow
```
Scraper → Background Script → Content Script → Notion API
                ↓
            Chrome Storage (token)
                ↓
            Notion Database
```

## Troubleshooting

### Common Issues
1. **"Notion token not set"**: Configure your integration token in the popup
2. **"No default database set"**: Either provide a database ID or let the extension create one
3. **"Connection failed"**: Check your integration token and ensure it has proper permissions
4. **Overlay not appearing**: Make sure you're on a Notion page (https://www.notion.so/*)

### Notion Integration Setup
1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Create a new integration
3. Share your Notion page/database with the integration
4. Copy the integration token
5. Paste it in the extension popup

## Future Enhancements
- Automatic database creation
- Multiple database support
- Assignment priority levels
- Due date reminders
- Bulk assignment import
- Custom field mapping

## References
- [Notion API Documentation](https://developers.notion.com/)
- [Chrome Extensions Guide](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
