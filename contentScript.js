// ===== NEW: Content Script for Notion Integration =====
// This script detects Notion pages and manages assignment data integration

console.log("UniTion: Content script loaded on Notion page");

// Store current page ID
let currentPageId = null;

// Get current Notion page ID from URL
function getNotionPageId() {
    const url = window.location.href;
    console.log("Current URL:", url);
    
    // Try different URL patterns
    let pageId = null;
    
    // Pattern 1: notion.so/page-name-pageId
    const match1 = url.match(/notion\.so\/([^?]+)/);
    if (match1) {
        const pagePath = match1[1];
        // Extract the last part after the last dash (the actual page ID)
        const parts = pagePath.split('-');
        pageId = parts[parts.length - 1];
        console.log("Extracted pageId (pattern 1):", pageId);
    }
    
    // Pattern 2: notion.so/pageId (direct ID)
    if (!pageId) {
        const match2 = url.match(/notion\.so\/([a-zA-Z0-9]{32})/);
        if (match2) {
            pageId = match2[1];
            console.log("Extracted pageId (pattern 2):", pageId);
        }
    }
    
    // Pattern 3: notion.so/page-name-pageId?v=...
    if (!pageId) {
        const match3 = url.match(/notion\.so\/([^?]+)\?/);
        if (match3) {
            const pagePath = match3[1];
            const parts = pagePath.split('-');
            pageId = parts[parts.length - 1];
            console.log("Extracted pageId (pattern 3):", pageId);
        }
    }
    
    if (pageId && pageId.length === 32) {
        console.log("Valid pageId found:", pageId);
        return pageId;
    } else {
        console.error("Could not extract valid pageId from URL:", url);
        return null;
    }
}

// Update page ID when URL changes
function updatePageId() {
    const newPageId = getNotionPageId();
    if (newPageId !== currentPageId) {
        console.log("Page ID changed from", currentPageId, "to", newPageId);
        currentPageId = newPageId;
    }
}

// Listen for URL changes (for SPA navigation)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("URL changed to:", url);
        updatePageId();
    }
}).observe(document, { subtree: true, childList: true });

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
    console.log("Popstate event - URL changed");
    updatePageId();
});

// Initialize page ID
updatePageId();

// Check if current page has a database
async function checkForDatabase(pageId) {
    try {
        // This would be called from background script
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_DATABASE',
            pageId: pageId
        });
        return response;
    } catch (error) {
        console.error('Error checking for database:', error);
        return { hasDatabase: false };
    }
}

// Show notification for new assignment data
function showAssignmentNotification(assignmentData) {
    // Remove any existing notification
    const existingNotification = document.getElementById('unition-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'unition-notification';
    notification.className = 'unition-notification';
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <h4>📚 New Assignment Detected</h4>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="assignment-info">
                <p><strong>Title:</strong> ${assignmentData.title}</p>
                <p><strong>Due Date:</strong> ${assignmentData.dueDate}</p>
                <p><strong>Points:</strong> ${assignmentData.points}</p>
                <p><strong>Class:</strong> ${assignmentData.className}</p>
            </div>
            <div class="notification-actions">
                <button id="addToDatabaseBtn" class="primary-btn">Add to Database</button>
                <button id="dismissBtn" class="secondary-btn">Dismiss</button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Event listeners
    document.getElementById('addToDatabaseBtn').onclick = () => {
        addAssignmentToDatabase(assignmentData);
        notification.remove();
    };

    document.getElementById('dismissBtn').onclick = () => {
        notification.remove();
    };
}

// Show notification for no database found
function showNoDatabaseNotification() {
    const notification = document.createElement('div');
    notification.id = 'unition-no-db-notification';
    notification.className = 'unition-notification warning';
    
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-header">
                <h4>⚠️ No Assignment Database Found</h4>
                <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-info">
                <p>Assignment data is available, but no database was found on this page.</p>
                <p>Create a database to start organizing your assignments!</p>
            </div>
            <div class="notification-actions">
                <button id="createDatabaseBtn" class="primary-btn">Create Database</button>
                <button id="dismissBtn" class="secondary-btn">Dismiss</button>
            </div>
        </div>
    `;

    document.body.appendChild(notification);

    // Event listeners
    document.getElementById('createDatabaseBtn').onclick = () => {
        createAssignmentDatabase().then(result => {
            if (result.success) {
                showSuccessNotification('Database created successfully!');
            } else {
                showErrorNotification(result.error);
            }
        });
        notification.remove();
    };

    document.getElementById('dismissBtn').onclick = () => {
        notification.remove();
    };
}

// Add assignment to existing database
async function addAssignmentToDatabase(assignmentData) {
    console.log("=== ADD ASSIGNMENT TO DATABASE DEBUG ===");
    console.log("Assignment data:", assignmentData);
    
    const pageId = getNotionPageId();
    console.log("Current page ID:", pageId);
    
    if (!pageId) {
        showErrorNotification('Could not determine page ID');
        return;
    }

    try {
        // First check for existing database
        console.log("Checking for existing database...");
        const dbCheck = await chrome.runtime.sendMessage({
            type: 'CHECK_DATABASE',
            pageId: pageId
        });
        
        console.log("Database check result:", dbCheck);

        if (!dbCheck.hasDatabase) {
            showErrorNotification('No assignment database found');
            return;
        }

        console.log("Found database:", dbCheck.databaseId);

        // Add the assignment to the database
        const response = await chrome.runtime.sendMessage({
            type: 'ADD_ASSIGNMENT',
            databaseId: dbCheck.databaseId,
            assignment: assignmentData
        });

        console.log("Add assignment response:", response);

        if (response.success) {
            showSuccessNotification('Assignment added successfully!');
        } else {
            showErrorNotification(response.error || 'Failed to add assignment');
        }
    } catch (error) {
        console.error("Error in addAssignmentToDatabase:", error);
        showErrorNotification('Error adding assignment');
    }
}

// Create new assignment database
async function createAssignmentDatabase() {
    console.log("=== CREATE DATABASE DEBUG ===");
    
    const pageId = getNotionPageId();
    console.log("Page ID for database creation:", pageId);
    
    if (!pageId) {
        console.error("Could not determine page ID for database creation");
        return { success: false, error: 'Could not determine page ID' };
    }

    try {
        console.log("Sending CREATE_DATABASE message with pageId:", pageId);
        const response = await chrome.runtime.sendMessage({
            type: 'CREATE_DATABASE',
            pageId: pageId,
            className: 'General'
        });

        console.log("CREATE_DATABASE response:", response);

        if (response.success) {
            console.log("Database created successfully with ID:", response.databaseId);
            showSuccessNotification('Database created successfully!');
            return { success: true, databaseId: response.databaseId };
        } else {
            console.error("Database creation failed:", response.error);
            showErrorNotification(response.error || 'Failed to create database');
            return { success: false, error: response.error || 'Failed to create database' };
        }
    } catch (error) {
        console.error("Error in createAssignmentDatabase:", error);
        showErrorNotification('Error creating database');
        return { success: false, error: error.message };
    }
}

// Show success notification
function showSuccessNotification(message) {
    showNotification(message, 'success');
}

// Show error notification
function showErrorNotification(message) {
    showNotification(message, 'error');
}

// Generic notification function
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `unition-toast ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.type === 'NEW_ASSIGNMENT') {
        // Check if current page has a database
        const pageId = getNotionPageId();
        if (pageId) {
            checkForDatabase(pageId).then(result => {
                if (result.hasDatabase) {
                    showAssignmentNotification(message.data);
                } else {
                    showNoDatabaseNotification();
                }
            });
        }
        sendResponse({ success: true });
    } else if (message.type === 'ADD_MULTIPLE_ASSIGNMENTS') {
        // Handle adding multiple assignments
        addMultipleAssignments(message.assignments).then(sendResponse);
        return true; // Keep message channel open for async response
    } else if (message.type === 'CREATE_DATABASE') {
        // Handle create database request
        const pageId = getNotionPageId();
        if (pageId) {
            createAssignmentDatabase().then(sendResponse);
            return true; // Keep message channel open for async response
        } else {
            sendResponse({ success: false, error: 'Could not determine page ID' });
        }
    }
});

// Add multiple assignments to database
async function addMultipleAssignments(assignments) {
    console.log("=== ADD MULTIPLE ASSIGNMENTS DEBUG ===");
    console.log("Assignments to add:", assignments);
    
    const pageId = getNotionPageId();
    console.log("Current page ID:", pageId);
    
    if (!pageId) {
        return { success: false, error: 'Could not determine page ID' };
    }

    try {
        // First check for existing database
        console.log("Checking for existing database...");
        const dbCheck = await chrome.runtime.sendMessage({
            type: 'CHECK_DATABASE',
            pageId: pageId
        });
        
        console.log("Database check result:", dbCheck);

        if (!dbCheck.hasDatabase) {
            return { success: false, error: 'No assignment database found on this page' };
        }

        console.log("Found database:", dbCheck.databaseId);

        // Add each assignment to the database
        let successCount = 0;
        let errorCount = 0;
        
        for (const assignment of assignments) {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'ADD_ASSIGNMENT',
                    databaseId: dbCheck.databaseId,
                    assignment: assignment
                });

                if (response.success) {
                    successCount++;
                    console.log(`Successfully added: ${assignment.title}`);
                } else {
                    errorCount++;
                    console.error(`Failed to add: ${assignment.title} - ${response.error}`);
                }
            } catch (error) {
                errorCount++;
                console.error(`Error adding: ${assignment.title}`, error);
            }
        }

        console.log(`Results: ${successCount} successful, ${errorCount} failed`);
        
        if (errorCount === 0) {
            return { success: true, message: `Successfully added ${successCount} assignments` };
        } else if (successCount > 0) {
            return { success: true, message: `Added ${successCount} assignments, ${errorCount} failed` };
        } else {
            return { success: false, error: `Failed to add any assignments (${errorCount} errors)` };
        }
    } catch (error) {
        console.error("Error in addMultipleAssignments:", error);
        return { success: false, error: error.message };
    }
}

// ===== END: Content Script =====
