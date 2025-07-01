// ===== NEW: Background Script for Notion Integration =====
// This script handles Notion API calls and database management using the working assignments.js logic

console.log("=== BACKGROUND SCRIPT LOADING ===");
console.log("UniTion: Background script loaded");

// Store for Notion integration token - HARDCODED
const notionToken = "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";

console.log("Notion token loaded:", !!notionToken);
console.log("Token length:", notionToken.length);
console.log("Token starts with:", notionToken.substring(0, 10) + "...");

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
    loadStoredData();
});

chrome.runtime.onInstalled.addListener(() => {
    loadStoredData();
});

// Load stored data from chrome.storage
async function loadStoredData() {
    // Store the hardcoded token
    await chrome.storage.local.set({ notionToken: notionToken });
    console.log("Stored Notion token in chrome.storage");
    
    // Test the token immediately
    testNotionConnection().then(result => {
        console.log("Initial token test result:", result);
    });
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("=== BACKGROUND MESSAGE RECEIVED ===");
    console.log("Message type:", message.type);
    console.log("Message data:", message);
    console.log("Sender:", sender);
    console.log("Current notionToken value:", !!notionToken);
    
    if (message.type === 'CHECK_DATABASE') {
        console.log("Processing CHECK_DATABASE...");
        listDatabases().then(result => {
            console.log("CHECK_DATABASE result:", result);
            sendResponse(result);
        });
        return true; // Keep message channel open for async response
    } else if (message.type === 'CREATE_DATABASE') {
        console.log("Processing CREATE_DATABASE...");
        console.log("Page ID:", message.pageId);
        console.log("Class name:", message.className);
        createAssignmentsDatabase(message.pageId, message.className || 'General').then(result => {
            console.log("CREATE_DATABASE result:", result);
            sendResponse(result);
        });
        return true;
    } else if (message.type === 'ADD_ASSIGNMENT') {
        console.log("Processing ADD_ASSIGNMENT...");
        addAssignment(message.databaseId, message.assignment).then(result => {
            console.log("ADD_ASSIGNMENT result:", result);
            sendResponse(result);
        });
        return true;
    } else if (message.type === 'SET_NOTION_TOKEN') {
        handleSetNotionToken(message.token);
        sendResponse({ success: true });
    } else if (message.type === 'GET_NOTION_STATUS') {
        sendResponse({ hasToken: !!notionToken });
    } else if (message.type === 'TEST_NOTION_CONNECTION') {
        testNotionConnection().then(sendResponse);
        return true;
    } else if (message.type === 'NEW_ASSIGNMENT') {
        // Forward assignment data to content script on Notion pages
        forwardAssignmentToNotion(message.data);
        sendResponse({ success: true });
    } else {
        console.error("Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
});

// ===== WORKING LOGIC FROM assignments.js =====

// List all databases (adapted from assignments.js)
async function listDatabases() {
    if (!notionToken) {
        return { hasDatabase: false, error: "Notion token not set" };
    }

    try {
        let databases = [];
        let cursor = undefined;
        
        do {
            const response = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${notionToken}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filter: { property: 'object', value: 'database' },
                    start_cursor: cursor,
                    page_size: 100
                })
            });

            if (!response.ok) {
                return { hasDatabase: false, error: "Failed to search databases" };
            }

            const data = await response.json();
            databases = databases.concat(data.results);
            cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor);

        console.log("Found databases:", databases.length);
        
        // Check if any database has assignment-related properties
        for (const database of databases) {
            const properties = database.properties;
            if (properties && (
                properties['Assignment Name'] || 
                properties['Assignment Title'] || 
                properties['Title'] || 
                properties['Done'] ||
                properties['Class Name'] ||
                properties['Class'] ||
                properties['Due Date']
            )) {
                return { 
                    hasDatabase: true, 
                    databaseId: database.id,
                    databaseName: database.title?.[0]?.plain_text || 'Untitled'
                };
            }
        }

        return { hasDatabase: false };
    } catch (error) {
        console.error("Error listing databases:", error);
        return { hasDatabase: false, error: error.message };
    }
}

// Create assignments database (adapted from assignments.js)
async function createAssignmentsDatabase(parentPageId, className) {
    console.log("=== CREATE ASSIGNMENTS DATABASE DEBUG ===");
    console.log("Parent page ID:", parentPageId);
    console.log("Class name:", className);
    console.log("Notion token available:", !!notionToken);
    
    if (!notionToken) {
        console.error("Notion token is not set!");
        return { success: false, error: "Notion token not set" };
    }

    try {
        const requestBody = {
            parent: { type: 'page_id', page_id: parentPageId },
            title: [{ type: 'text', text: { content: `${className} Assignments` } }],
            properties: {
                'Assignment Name': { title: {} },
                'Due Date': { date: {} },
                'Due Time': { rich_text: {} },
                'Done': { checkbox: {} },
                'Class Name': { rich_text: {} },
                'Details': { rich_text: {} }
            }
        };
        
        console.log("Database creation request body:", JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Database creation response status:", response.status);
        console.log("Database creation response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Database creation API error:", errorData);
            return { success: false, error: `Failed to create database: ${response.status} ${errorData}` };
        }

        const database = await response.json();
        console.log("Database created successfully:", database);
        console.log('Database created! Database ID:', database.id);
        return { success: true, databaseId: database.id };
    } catch (error) {
        console.error("Error creating database:", error);
        return { success: false, error: error.message };
    }
}

// Add assignment (adapted from assignments.js)
async function addAssignment(databaseId, assignment) {
    console.log("=== ADD ASSIGNMENT DEBUG ===");
    console.log("Database ID:", databaseId);
    console.log("Assignment data:", assignment);
    console.log("Notion token available:", !!notionToken);
    
    if (!notionToken) {
        console.error("Notion token is not set!");
        return { success: false, error: "Notion token not set" };
    }

    try {
        const requestBody = {
            parent: { database_id: databaseId },
            properties: {
                'Assignment Name': {
                    title: [{ text: { content: assignment.title } }]
                },
                'Due Date': {
                    date: { start: assignment.dueDate }
                },
                'Due Time': {
                    rich_text: [{ text: { content: '12:00 PM' } }]
                },
                'Done': { checkbox: false },
                'Class Name': {
                    rich_text: [{ text: { content: assignment.className } }]
                },
                'Details': {
                    rich_text: [{ text: { content: `Points: ${assignment.points}` } }]
                }
            }
        };
        
        console.log("Request body:", JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Response status:", response.status);
        console.log("Response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Notion API error response:", errorData);
            return { success: false, error: `Failed to add assignment: ${response.status} ${errorData}` };
        }

        const result = await response.json();
        console.log("Success response:", result);
        console.log('Assignment added!');
        return { success: true };
    } catch (error) {
        console.error("Error adding assignment:", error);
        return { success: false, error: error.message };
    }
}

// ===== END: WORKING LOGIC FROM assignments.js =====

// Forward assignment data to Notion pages
function forwardAssignmentToNotion(assignmentData) {
    chrome.tabs.query({ url: "https://www.notion.so/*" }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'NEW_ASSIGNMENT',
                data: assignmentData
            });
        }
    });
}

// Handle setting Notion token
async function handleSetNotionToken(token) {
    // This function is kept for compatibility but token is hardcoded
    await chrome.storage.local.set({ notionToken: token });
    console.log("Notion token stored");
}

// Test Notion connection
async function testNotionConnection() {
    if (!notionToken) {
        return { success: false, error: "No token set" };
    }

    try {
        const response = await fetch('https://api.notion.com/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28'
            }
        });

        if (response.ok) {
            return { success: true };
        } else {
            return { success: false, error: "Invalid token" };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== END: Background Script ===== 