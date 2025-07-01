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
    console.log("Received message in background:", message);

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
        listDatabases().then(result => sendResponse(result));
        return true;
    } else if (message.type === 'CREATE_DATABASE') {
        createAssignmentsDatabase(message.pageId, message.className || 'General').then(result => sendResponse(result));
        return true;
    } else if (message.type === 'ADD_ASSIGNMENT') {
        addAssignment(message.databaseId, message.assignment).then(result => sendResponse(result));
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
    } else {
        console.error("Unknown message type:", message.type);
        sendResponse({ success: false, error: "Unknown message type" });
    }
});

async function listDatabases() {
    if (!notionToken) return { hasDatabase: false, error: "Notion token not set" };
    try {
        let databases = [], cursor = undefined;
        do {
            const response = await fetch('https://api.notion.com/v1/search', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${notionToken}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filter: { property: 'object', value: 'database' }, start_cursor: cursor, page_size: 100 })
            });
            if (!response.ok) return { hasDatabase: false, error: "Failed to search databases" };
            const data = await response.json();
            databases = databases.concat(data.results);
            cursor = data.has_more ? data.next_cursor : undefined;
        } while (cursor);

        for (const db of databases) {
            const props = db.properties;
            if (props && (props['Assignment Name'] || props['Assignment Title'] || props['Title'] || props['Done'] || props['Class Name'] || props['Class'] || props['Due Date'])) {
                return { hasDatabase: true, databaseId: db.id, databaseName: db.title?.[0]?.plain_text || 'Untitled' };
            }
        }
        return { hasDatabase: false };
    } catch (err) {
        console.error("Error listing databases:", err);
        return { hasDatabase: false, error: err.message };
    }
}

async function createAssignmentsDatabase(parentPageId, className) {
    if (!notionToken) return { success: false, error: "Notion token not set" };
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
        const response = await fetch('https://api.notion.com/v1/databases', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.text();
            return { success: false, error: `Failed to create database: ${response.status} ${errorData}` };
        }
        const database = await response.json();
        return { success: true, databaseId: database.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function addAssignment(databaseId, assignment) {
    if (!notionToken) return { success: false, error: "Notion token not set" };
    try {
        const requestBody = {
            parent: { database_id: databaseId },
            properties: {
                'Assignment Name': { title: [{ text: { content: assignment.title } }] },
                'Due Date': { date: { start: assignment.dueDate } },
                'Due Time': { rich_text: [{ text: { content: '12:00 PM' } }] },
                'Done': { checkbox: false },
                'Class Name': { rich_text: [{ text: { content: assignment.className } }] },
                'Details': { rich_text: [{ text: { content: `Points: ${assignment.points}` } }] }
            }
        };
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.text();
            return { success: false, error: `Failed to add assignment: ${response.status} ${errorData}` };
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function forwardAssignmentToNotion(data) {
    chrome.tabs.query({ url: "https://www.notion.so/*" }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'NEW_ASSIGNMENT',
                data
            });
        }
    });
}

async function handleSetNotionToken(token) {
    await chrome.storage.local.set({ notionToken: token });
    console.log("Notion token stored");
}

async function testNotionConnection() {
    if (!notionToken) return { success: false, error: "No token set" };
    try {
        const response = await fetch('https://api.notion.com/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28'
            }
        });
        return response.ok ? { success: true } : { success: false, error: "Invalid token" };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== END: MERGED BACKGROUND SCRIPT =====
