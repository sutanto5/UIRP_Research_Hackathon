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

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("=== CONTENT SCRIPT MESSAGE RECEIVED ===");
    console.log("Message type:", message.type);
    console.log("Message data:", message);

    if (message.type === 'CREATE_DATABASE') {
        console.log("Creating database...");
        createAssignmentDatabase().then(result => {
            console.log("CREATE_DATABASE result:", result);
            sendResponse(result);
        });
        return true;
    } else if (message.type === 'ADD_MULTIPLE_ASSIGNMENTS') {
        console.log("Adding multiple assignments...");
        addMultipleAssignments(message.assignments).then(result => {
            console.log("ADD_MULTIPLE_ASSIGNMENTS result:", result);
            sendResponse(result);
        });
        return true;
    } else if (message.type === 'SCRAPE_TABLE_DATA') {
        console.log("Scraping table data...");
        scrapeTableData().then(result => {
            console.log("SCRAPE_TABLE_DATA result:", result);
            sendResponse(result);
        });
        return true;
    } else if (message.type === 'SCRAPE_ASSIGNMENTS') {
        console.log("Scraping assignments...");
        scrapeAssignments().then(result => {
            console.log("SCRAPE_ASSIGNMENTS result:", result);
            sendResponse(result);
        });
        return true;
    } else {
        console.error("Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
});

// Scrape table data from the current page
async function scrapeTableData() {
    try {
        console.log("=== SCRAPING TABLE DATA ===");
        
        // Look for common table patterns
        const tables = document.querySelectorAll('table');
        console.log("Found tables:", tables.length);
        
        if (tables.length === 0) {
            return { success: false, error: "No tables found on page" };
        }
        
        const assignments = [];
        
        // Process each table
        for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            console.log("Table rows:", rows.length);
            
            // Skip header row if it exists
            const dataRows = Array.from(rows).slice(1);
            
            for (const row of dataRows) {
                const cells = row.querySelectorAll('td, th');
                if (cells.length >= 3) {
                    // Try to extract assignment data
                    const assignment = extractAssignmentFromRow(cells);
                    if (assignment) {
                        assignments.push(assignment);
                    }
                }
            }
        }
        
        console.log("Scraped assignments:", assignments);
        
        if (assignments.length > 0) {
            // Store the scraped data
            chrome.storage.local.set({ scrapedAssignments: assignments });
            return { success: true, assignments: assignments };
        } else {
            return { success: false, error: "No assignment data found in tables" };
        }
        
    } catch (error) {
        console.error("Error scraping table data:", error);
        return { success: false, error: error.message };
    }
}

// Scrape assignments from the current page (general scraping)
async function scrapeAssignments() {
    try {
        console.log("=== SCRAPING ASSIGNMENTS ===");
        
        // First try to get stored scraped data
        const stored = await chrome.storage.local.get(['scrapedAssignments']);
        if (stored.scrapedAssignments && stored.scrapedAssignments.length > 0) {
            console.log("Using stored scraped assignments:", stored.scrapedAssignments);
            return { success: true, assignments: stored.scrapedAssignments };
        }
        
        // If no stored data, try to scrape from current page
        return await scrapeTableData();
        
    } catch (error) {
        console.error("Error scraping assignments:", error);
        return { success: false, error: error.message };
    }
}

// Extract assignment data from a table row
function extractAssignmentFromRow(cells) {
    try {
        const cellTexts = Array.from(cells).map(cell => cell.textContent.trim());
        console.log("Cell texts:", cellTexts);
        
        // Look for common patterns
        let title = '';
        let dueDate = '';
        let points = '';
        let className = '';
        let url = '';
        let assignmentType = 'Assignment';
        let difficulty = 'Intermediate';
        let estimatedHours = 4;
        let description = '';
        
        // Try to identify assignment title (usually first column or contains keywords)
        for (let i = 0; i < cellTexts.length; i++) {
            const text = cellTexts[i].toLowerCase();
            if (text.includes('assignment') || text.includes('homework') || text.includes('project') || 
                text.includes('lab') || text.includes('quiz') || text.includes('exam') ||
                text.includes('mp') || text.includes('machine problem')) {
                title = cellTexts[i];
                description = cellTexts[i];
                
                // Determine assignment type
                if (text.includes('mp') || text.includes('machine problem')) {
                    assignmentType = 'Machine Problem';
                    difficulty = 'Advanced';
                    estimatedHours = 8;
                } else if (text.includes('lab')) {
                    assignmentType = 'Laboratory';
                    difficulty = 'Intermediate';
                    estimatedHours = 4;
                } else if (text.includes('homework')) {
                    assignmentType = 'Homework';
                    difficulty = 'Intermediate';
                    estimatedHours = 5;
                } else if (text.includes('exam')) {
                    assignmentType = 'Exam';
                    difficulty = 'Advanced';
                    estimatedHours = 2;
                } else if (text.includes('project')) {
                    assignmentType = 'Project';
                    difficulty = 'Advanced';
                    estimatedHours = 12;
                }
                break;
            }
        }
        
        // If no clear title found, use first non-empty cell
        if (!title) {
            title = cellTexts.find(text => text.length > 0) || 'Untitled Assignment';
            description = title;
        }
        
        // Look for due date (contains date patterns)
        for (const text of cellTexts) {
            if (text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/) || 
                text.match(/\d{1,2}-\d{1,2}-\d{2,4}/) ||
                text.match(/\w+ \d{1,2},? \d{4}/) ||
                text.match(/\d{1,2}\/\d{1,2}/)) {
                dueDate = text;
                break;
            }
        }
        
        // Look for points (contains numbers)
        for (const text of cellTexts) {
            if (text.match(/\d+/) && (text.includes('point') || text.includes('pts') || text.includes('%'))) {
                points = text;
                break;
            }
        }
        
        // Try to get URL from links
        const links = Array.from(cells).flatMap(cell => cell.querySelectorAll('a'));
        if (links.length > 0) {
            url = links[0].href;
        }
        
        // Try to determine class name from page context
        const pageTitle = document.title.toLowerCase();
        const pageUrl = window.location.href.toLowerCase();
        
        if (pageTitle.includes('ece220') || pageTitle.includes('ece 220') || pageUrl.includes('ece220')) {
            className = 'ECE220';
        } else if (pageTitle.includes('phy220') || pageTitle.includes('phy 220') || pageUrl.includes('phy220')) {
            className = 'PHY220';
        } else if (pageTitle.includes('phy221') || pageTitle.includes('phy 221') || pageUrl.includes('phy221')) {
            className = 'PHY221';
        } else if (pageTitle.includes('cs') || pageTitle.includes('computer science')) {
            className = 'CS';
        } else {
            className = 'General';
        }
        
        // Enhanced assignment object with all fields
        const assignment = {
            title: title,
            assignment: title,
            dueDate: dueDate,
            due_date: dueDate,
            points: points || 'N/A',
            className: className,
            course: className,
            url: url,
            assignment_type: assignmentType,
            description: description,
            difficulty: difficulty,
            estimated_hours: estimatedHours,
            status: 'Not Started'
        };
        
        console.log("Extracted assignment:", assignment);
        return assignment;
        
    } catch (error) {
        console.error("Error extracting assignment from row:", error);
        return null;
    }
}

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
