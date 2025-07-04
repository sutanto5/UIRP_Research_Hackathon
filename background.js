// ===== MERGED BACKGROUND SCRIPT (Notion + Google Auth) =====

console.log("=== BACKGROUND SCRIPT LOADING ===");
console.log("UniTion: Background script loaded");

// Notion Integration
const notionToken = "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";
console.log("Notion token loaded:", !!notionToken);
console.log("Token length:", notionToken.length);
console.log("Token starts with:", notionToken.substring(0, 10) + "...");

chrome.runtime.onStartup.addListener(() => {
    loadStoredData();
});

chrome.runtime.onInstalled.addListener(() => {
    loadStoredData();
});

async function loadStoredData() {
    await chrome.storage.local.set({ notionToken: notionToken });
    console.log("Stored Notion token in chrome.storage");
    testNotionConnection().then(result => {
        console.log("Initial token test result:", result);
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("=== BACKGROUND MESSAGE RECEIVED ===");
    console.log("Message type:", message.type);
    console.log("Message data:", message);
    console.log("Sender:", sender);
    console.log("Current notionToken value:", !!notionToken);

    if (message.type === "getAuthToken") {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ token });
            }
        });
        return true;
    }

    if (message.type === 'CHECK_DATABASE') {
        console.log("Processing CHECK_DATABASE...");
        listDatabases().then(result => {
            console.log("CHECK_DATABASE result:", result);
            sendResponse(result);
        });
        return true;
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
        forwardAssignmentToNotion(message.data);
        sendResponse({ success: true });
    } else if (message.type === 'ADD_TO_GOOGLE_CALENDAR') {
        addToGoogleCalendar(message.assignments).then(sendResponse);
        return true;
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
                const errorData = await response.json();
                console.error("Database search failed:", errorData);
                return { hasDatabase: false, error: `Failed to search databases: ${errorData.message || response.statusText}` };
            }

            const data = await response.json();
            databases = databases.concat(data.results);
            cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor);

        console.log("Found databases:", databases.length);
        console.log("Database details:", databases.map(db => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled',
            properties: Object.keys(db.properties || {})
        })));
        
        // Check if any database has assignment-related properties
        for (const database of databases) {
            const properties = database.properties;
            if (properties) {
                const propertyNames = Object.keys(properties);
                console.log(`Database ${database.id} properties:`, propertyNames);
                
                // More flexible property matching
                const hasAssignmentProps = propertyNames.some(name => 
                    name.toLowerCase().includes('assignment') ||
                    name.toLowerCase().includes('title') ||
                    name.toLowerCase().includes('name') ||
                    name.toLowerCase().includes('due') ||
                    name.toLowerCase().includes('class') ||
                    name.toLowerCase().includes('course')
                );
                
                if (hasAssignmentProps) {
                    console.log(`Found assignment database: ${database.id}`);
                    return { 
                        hasDatabase: true, 
                        databaseId: database.id,
                        databaseName: database.title?.[0]?.plain_text || 'Untitled',
                        properties: propertyNames
                    };
                }
            }
        }

        return { hasDatabase: false, databases: databases.length };
    } catch (error) {
        console.error("Error listing databases:", error);
        return { hasDatabase: false, error: error.message };
    }
}

// Create assignments database (adapted from assignments.js)
async function createAssignmentsDatabase(pageId, className) {
    if (!notionToken) {
        return { success: false, error: "Notion token not set" };
    }

    if (!pageId) {
        return { success: false, error: "Page ID is required" };
    }

    try {
        console.log("Creating database on page:", pageId);
        console.log("Class name:", className);

        const response = await fetch('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                parent: { page_id: pageId },
                title: [
                    {
                        type: 'text',
                        text: { content: `${className} Assignments` }
                    }
                ],
                properties: {
                    'Assignment Name': {
                        title: {}
                    },
                    'Due Date': {
                        date: {}
                    },
                    'Points': {
                        number: {}
                    },
                    'Class Name': {
                        select: {
                            options: [
                                { name: className, color: 'blue' }
                            ]
                        }
                    },
                    'Done': {
                        checkbox: {}
                    },
                    'URL': {
                        url: {}
                    }
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Database creation failed:", errorData);
            return { success: false, error: `Failed to create database: ${errorData.message || response.statusText}` };
        }

        const database = await response.json();
        console.log("Database created successfully:", database.id);
        
        return { 
            success: true, 
            databaseId: database.id,
            databaseName: database.title?.[0]?.plain_text || 'Untitled'
        };
    } catch (error) {
        console.error("Error creating database:", error);
        return { success: false, error: error.message };
    }
}

// Add assignment to database (adapted from assignments.js)
async function addAssignment(databaseId, assignment) {
    if (!notionToken) {
        return { success: false, error: "Notion token not set" };
    }

    if (!databaseId) {
        return { success: false, error: "Database ID is required" };
    }

    try {
        console.log("Adding assignment to database:", databaseId);
        console.log("Assignment data:", assignment);

        // Normalize assignment data
        const title = assignment.title || assignment.assignment || assignment.machine_problem || 'Untitled Assignment';
        const className = assignment.className || assignment.course || 'General';
        const points = assignment.points || assignment.points || 'N/A';
        const url = assignment.url || '';
        
        // Parse due date
        let dueDate = null;
        if (assignment.dueDate || assignment.due_date) {
            const dateStr = assignment.dueDate || assignment.due_date;
            try {
                // Handle different date formats
                let parsedDate;
                if (dateStr.includes('/')) {
                    // Handle MM/DD or MM/DD/YYYY format
                    const parts = dateStr.split('/');
                    if (parts.length === 2) {
                        // MM/DD format - assume current year
                        const year = new Date().getFullYear();
                        parsedDate = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
                    } else if (parts.length === 3) {
                        // MM/DD/YYYY format
                        parsedDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
                    }
                } else {
                    // Try direct parsing
                    parsedDate = new Date(dateStr);
                }
                
                if (!isNaN(parsedDate.getTime())) {
                    dueDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD format
                }
            } catch (error) {
                console.warn("Could not parse date:", dateStr, error);
            }
        }

        // Parse points to number
        let pointsNumber = null;
        if (points && points !== 'N/A') {
            const pointsMatch = points.toString().match(/\d+/);
            if (pointsMatch) {
                pointsNumber = parseInt(pointsMatch[0]);
            }
        }

        const requestBody = {
            parent: { database_id: databaseId },
            properties: {
                'Assignment Name': {
                    title: [
                        {
                            type: 'text',
                            text: { content: title }
                        }
                    ]
                },
                'Due Date': {
                    date: dueDate ? { start: dueDate } : null
                },
                'Points': {
                    number: pointsNumber
                },
                'Class Name': {
                    select: { name: className }
                },
                'Done': {
                    checkbox: false
                },
                'URL': {
                    url: url || null
                }
            }
        };

        console.log("Request body for Notion API:", JSON.stringify(requestBody, null, 2));

        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log("Notion API response status:", response.status);
        console.log("Notion API response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Assignment creation failed:", errorData);
            return { success: false, error: `Failed to create assignment: ${errorData.message || response.statusText}` };
        }

        const page = await response.json();
        console.log("Assignment created successfully:", page.id);
        
        return { success: true, pageId: page.id };
    } catch (error) {
        console.error("Error adding assignment:", error);
        return { success: false, error: error.message };
    }
}

// Forward assignment data to content script on Notion pages
function forwardAssignmentToNotion(data) {
    chrome.tabs.query({ url: "*://*.notion.so/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'NEW_ASSIGNMENT_DATA',
                data: data
            }).catch(err => {
                console.log("Could not send to tab:", tab.id, err);
            });
        });
    });
}

async function handleSetNotionToken(token) {
    try {
        await chrome.storage.local.set({ notionToken: token });
        console.log("Notion token stored successfully");
    } catch (error) {
        console.error("Failed to store Notion token:", error);
    }
}

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
            const user = await response.json();
            return { 
                success: true, 
                user: user.name || user.id,
                message: "Connection successful"
            };
        } else {
            const error = await response.json();
            return { 
                success: false, 
                error: error.message || `HTTP ${response.status}`,
                details: error
            };
        }
    } catch (error) {
        return { 
            success: false, 
            error: error.message || "Network error",
            details: error
        };
    }
}

// Add assignments to Google Calendar
async function addToGoogleCalendar(assignments) {

    try {

        console.log("📤 Adding assignments to Google Calendar:", assignments);

 

        // 🔐 Get Google Auth token

        const authResponse = await new Promise((resolve) => {

            chrome.identity.getAuthToken({ interactive: true }, (token) => {

                if (chrome.runtime.lastError) {

                    resolve({ error: chrome.runtime.lastError.message });

                } else {

                    resolve({ token });

                }

            });

        });

 

        if (authResponse.error) {

            return { success: false, error: `Google Auth failed: ${authResponse.error}` };

        }

 

        const token = authResponse.token;

        const calendarId = 'primary';

        const results = [];

 

        for (const assignment of assignments) {

            try {

                const event = {

                    summary: `${assignment.className}: ${assignment.title}`,

                    description: `Assignment: ${assignment.title}\nPoints: ${assignment.points}\nURL: ${assignment.url || 'N/A'}`,

                    start: {

                        dateTime: assignment.dueDate ? new Date(assignment.dueDate).toISOString() : new Date().toISOString(),

                        timeZone: 'America/Chicago'

                    },

                    end: {

                        dateTime: assignment.dueDate ? new Date(new Date(assignment.dueDate).getTime() + 60 * 60 * 1000).toISOString() : new Date(new Date().getTime() + 60 * 60 * 1000).toISOString(),

                        timeZone: 'America/Chicago'

                    },

                    reminders: {

                        useDefault: false,

                        overrides: [

                            { method: 'email', minutes: 24 * 60 },

                            { method: 'popup', minutes: 60 }

                        ]

                    }

                };

 

                const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {

                    method: 'POST',

                    headers: {

                        'Authorization': `Bearer ${token}`,

                        'Content-Type': 'application/json'

                    },

                    body: JSON.stringify(event)

                });

 

                if (response.ok) {

                    const result = await response.json();

                    results.push({ success: true, assignment: assignment.title, eventId: result.id });

                } else {

                    const error = await response.json();

                    results.push({ success: false, assignment: assignment.title, error: error.error?.message || 'Unknown error' });

                }

            } catch (error) {

                results.push({ success: false, assignment: assignment.title, error: error.message });

            }

        }

 

        const successful = results.filter(r => r.success).length;

        const failed = results.filter(r => !r.success).length;

 

        return {

            success: successful > 0,

            message: `Added ${successful} assignments to Google Calendar${failed > 0 ? `, ${failed} failed` : ''}`,

            results: results

        };

 

    } catch (error) {

        console.error("❌ Error adding to Google Calendar:", error);

        return { success: false, error: error.message };

    }

}

 

// ✅ Correctly REGISTER the message listener OUTSIDE the function

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'ADD_TO_GOOGLE_CALENDAR') {

        const cleanedAssignments = message.assignments.map(a => ({

            title: a.assignment || "Untitled Assignment",

            dueDate: a.due_date,

            points: a.points || "100",

            className: a.course || "General",

            url: a.url || "https;;"

        }));

        addToGoogleCalendar(cleanedAssignments).then(response => {

            sendResponse(response);

        });

        return true; // Required for async response

    }

});