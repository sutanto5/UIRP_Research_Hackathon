document.addEventListener("DOMContentLoaded", function () {
    const websiteDisplay = document.getElementById("websiteDisplay");
    const changeBgBtn = document.getElementById("changeBgBtn");
    const confirmButton = document.getElementById("confirmButton");
    const tableButton = document.getElementById("tableButton");

    let currentUrl = "";
    let scrapedAssignments = [];

    // Display the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        currentUrl = currentTab.url;
        websiteDisplay.textContent = currentUrl;
        websiteDisplay.title = currentUrl; // hover to see full URL
        
        // Check if we're on a Notion page
        const isNotionPage = currentUrl && currentUrl.includes('notion.so');
        
        if (isNotionPage) {
            // Replace the entire UI with Notion interface
            showNotionInterface();
        } else {
            // Remove the original confirm button since we're using the table button as confirm
            if (confirmButton) {
                confirmButton.remove();
            }
            
            // Add permanent course name input
            addCourseNameInput();
        }
    });

    function showNotionInterface() {
        // Clear the existing content
        document.body.innerHTML = '';
        
        // Create new Notion-specific UI with exact original styling
        const notionContainer = document.createElement('div');
        notionContainer.style.cssText = `
            background-image: linear-gradient(white, skyblue);
            font-family: 'MyFont', sans-serif;
            font-size: 15px;
            text-align: center;
            padding: 20px;
            min-width: 300px;
            min-height: 350px;
            overflow: hidden;
        `;
        
        notionContainer.innerHTML = `
            <h1 style="font-family: 'MyFont', serif; color: #333;">UniTion</h1>
            <p style="margin-bottom: 20px; font-style: italic; color: #666;">Unifying Your Assignments Into Notion.</p>
            
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(255, 255, 255, 0.9); border-radius: 8px; border: 2px solid #8b48bc;">
                <h4 style="margin: 0 0 15px 0; color: #333; font-family: 'MyFont', serif;">Database Management</h4>
                <button id="createDatabaseBtn" style="font-family: 'MyFont', monospace; font-size: 16px; background-color: #8b48bc; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; width: 200px; margin: 5px; transition: background-color 0.3s ease;">Create Assignment Database</button>
                <div id="databaseStatus" style="font-size: 12px; color: #666; text-align: center; margin-top: 10px;"></div>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background: rgba(255, 255, 255, 0.9); border-radius: 8px; border: 2px solid #8b48bc;">
                <h4 style="margin: 0 0 15px 0; color: #333; font-family: 'MyFont', serif;">Upcoming Deadlines</h4>
                <button id="viewAssignmentsBtn" style="font-family: 'MyFont', monospace; font-size: 16px; background-color: #8b48bc; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; width: 200px; margin: 5px; transition: background-color 0.3s ease;">View Deadlines</button>
                
                <div id="assignmentsInterface" style="display: none;">
                    <div style="margin-bottom: 10px;">
                        <button id="selectAllBtn" style="font-family: 'MyFont', monospace; font-size: 14px; background-color: #6c757d; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; width: 48%; margin-right: 2%; transition: background-color 0.3s ease;">Select All</button>
                        <button id="deselectAllBtn" style="font-family: 'MyFont', monospace; font-size: 14px; background-color: #6c757d; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; width: 48%; margin-left: 2%; transition: background-color 0.3s ease;">Deselect All</button>
                    </div>
                    
                    <div id="assignmentsList" style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: white; margin-bottom: 10px;">
                        <!-- Assignments will be loaded here -->
                    </div>
                    
                    <button id="addSelectedBtn" style="font-family: 'MyFont', monospace; font-size: 14px; background-color: #28a745; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; width: 100%; margin-bottom: 10px; transition: background-color 0.3s ease;">Add Selected to Notion</button>
                    <button id="addToCalendarBtn" style="font-family: 'MyFont', monospace; font-size: 14px; background-color: #007bff; color: white; padding: 8px 15px; border: none; border-radius: 8px; cursor: pointer; width: 100%; transition: background-color 0.3s ease;">Add Selected to Google Calendar</button>
                </div>
            </div>
            
            <div style="text-align: center; font-size: 12px; color: #666;">
                <div>Current URL: <span id="currentUrlDisplay" style="word-break: break-all;"></span></div>
            </div>
        `;
        
        document.body.appendChild(notionContainer);
        
        // Update URL display
        document.getElementById('currentUrlDisplay').textContent = currentUrl;
        
        // Add event listeners for Notion functionality
        setupNotionEventListeners();
    }

    function setupNotionEventListeners() {
        // Create Database button
        document.getElementById('createDatabaseBtn').addEventListener('click', () => {
            console.log("Create Database button clicked!");
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                console.log("Sending CREATE_DATABASE message to tab:", tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, { type: 'CREATE_DATABASE' }, (response) => {
                    console.log("CREATE_DATABASE response from content script:", response);
                    if (response && response.success) {
                        showMessage('Database created successfully!', 'success');
                        updateDatabaseStatus('Database created successfully!');
                    } else if (response && response.error) {
                        showMessage(`Database creation failed: ${response.error}`, 'error');
                        updateDatabaseStatus(`Error: ${response.error}`);
                    }
                });
            });
            showMessage('Creating new database...', 'info');
        });

        // View assignments button
        document.getElementById('viewAssignmentsBtn').addEventListener('click', async () => {
            console.log("View Deadlines button clicked!");
            const assignmentsInterface = document.getElementById('assignmentsInterface');
            console.log("Assignments interface display:", assignmentsInterface.style.display);
            
            if (assignmentsInterface.style.display === 'none') {
                console.log("Loading assignments...");
                
                // Check if we have scraped assignments from the table button
                if (window.scrapedAssignments && window.scrapedAssignments.length > 0) {
                    console.log("Using scraped assignments:", window.scrapedAssignments);
                    scrapedAssignments = window.scrapedAssignments;
                    displayAssignments(window.scrapedAssignments);
                    assignmentsInterface.style.display = 'block';
                    document.getElementById('viewAssignmentsBtn').textContent = 'Hide Deadlines';
                    console.log("✅ Assignments interface is now visible (from scraped data)");
                    
                    // Check if Google Calendar button is now accessible
                    const calendarBtn = document.getElementById('addToCalendarBtn');
                    if (calendarBtn) {
                        console.log("✅ Google Calendar button is accessible after showing assignments");
                    } else {
                        console.error("❌ Google Calendar button still not found after showing assignments");
                    }
                } else {
                    // Fallback to scraping from current page
                    try {
                        const scrapedData = await scrapeAssignmentsFromPage();
                        console.log("Scraped data from page:", scrapedData);
                        if (scrapedData && scrapedData.length > 0) {
                            scrapedAssignments = scrapedData;
                            displayAssignments(scrapedData);
                            assignmentsInterface.style.display = 'block';
                            document.getElementById('viewAssignmentsBtn').textContent = 'Hide Deadlines';
                            console.log("✅ Assignments interface is now visible (from page scraping)");
                        } else {
                            showMessage('No assignments found. Try using the Table button on a course page first.', 'error');
                            console.log("❌ No assignments found from page scraping");
                        }
                    } catch (error) {
                        console.error("Error loading assignments:", error);
                        showMessage('Error loading assignments', 'error');
                    }
                }
            } else {
                // Hide interface
                assignmentsInterface.style.display = 'none';
                document.getElementById('viewAssignmentsBtn').textContent = 'View Deadlines';
                console.log("✅ Assignments interface hidden");
            }
        });

        // Select all button
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.checked = true);
        });

        // Deselect all button
        document.getElementById('deselectAllBtn').addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]');
            checkboxes.forEach(checkbox => checkbox.checked = false);
        });

        // Add selected assignments to Notion button
        document.getElementById('addSelectedBtn').addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                showMessage('Please select at least one assignment', 'error');
                return;
            }

            const selectedAssignments = [];
            const selectedCheckboxes = [];
            checkboxes.forEach(checkbox => {
                const assignmentData = JSON.parse(checkbox.dataset.assignment);
                selectedAssignments.push(assignmentData);
                selectedCheckboxes.push(checkbox);
            });

            showMessage(`Adding ${selectedAssignments.length} assignments to Notion...`, 'info');
            
            // Get current tab to find the page ID
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            // Send message to content script to get page ID and add assignments
            try {
                const response = await chrome.tabs.sendMessage(currentTab.id, {
                    type: 'ADD_MULTIPLE_ASSIGNMENTS',
                    assignments: selectedAssignments
                });
                
                if (response && response.success) {
                    // Remove successfully added assignments from the list
                    selectedCheckboxes.forEach(checkbox => {
                        const assignmentDiv = checkbox.closest('div');
                        if (assignmentDiv) {
                            assignmentDiv.remove();
                        }
                    });
                    
                    showMessage(`Successfully added ${selectedAssignments.length} assignments to Notion!`, 'success');
                } else {
                    showMessage(`Failed to add assignments: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding assignments:", error);
                showMessage('Error adding assignments. Please check console for details.', 'error');
            }
        });

        // Add selected assignments to Google Calendar button
        document.getElementById('addToCalendarBtn').addEventListener('click', async () => {
            console.log("Google Calendar button clicked!");
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                showMessage('Please select at least one assignment', 'error');
            return;
        }

            const selectedAssignments = [];
            checkboxes.forEach(checkbox => {
                const assignmentData = JSON.parse(checkbox.dataset.assignment);
                selectedAssignments.push(assignmentData);
            });

            console.log("Selected assignments for calendar:", selectedAssignments);
            showMessage(`Adding ${selectedAssignments.length} assignments to Google Calendar...`, 'info');
            
            // Send message to background script to handle Google Calendar integration
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'ADD_TO_GOOGLE_CALENDAR',
                    assignments: selectedAssignments
                });
                
                console.log("Google Calendar response:", response);
                if (response && response.success) {
                    showMessage(`Successfully added ${selectedAssignments.length} assignments to Google Calendar!`, 'success');
                } else {
                    showMessage(`Failed to add to calendar: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding to calendar:", error);
                showMessage('Error adding to Google Calendar. Please check console for details.', 'error');
            }
        });
        
        // Debug: Check if Google Calendar button exists
        const calendarBtn = document.getElementById('addToCalendarBtn');
        if (calendarBtn) {
            console.log("✅ Google Calendar button found and event listener attached");
        } else {
            console.error("❌ Google Calendar button not found!");
        }
    }

    // Scrape assignments from the current page
    async function scrapeAssignmentsFromPage() {
        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            
            const response = await chrome.tabs.sendMessage(currentTab.id, {
                type: 'SCRAPE_ASSIGNMENTS'
            });
            
            if (response && response.success && response.assignments) {
                return response.assignments;
            }
            return [];
        } catch (error) {
            console.error("Error scraping assignments:", error);
            return [];
        }
    }

    // Helper function to display assignments
    function displayAssignments(assignments) {
        const assignmentsList = document.getElementById('assignmentsList');
        assignmentsList.innerHTML = '';
        
        assignments.forEach((assignment, index) => {
            const assignmentDiv = document.createElement('div');
            assignmentDiv.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px;
                border-bottom: 1px solid #eee;
                font-size: 12px;
                font-family: 'MyFont', sans-serif;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            
            // Handle different assignment data formats
            let assignmentData;
            if (assignment.machine_problem) {
                // ECE220 format
                assignmentData = {
                    title: assignment.machine_problem,
                    dueDate: assignment.due_date,
                    points: assignment.points,
                    className: 'ECE220',
                    url: assignment.url
                };
            } else if (assignment.title) {
                // Generic format
                assignmentData = {
                    title: assignment.title,
                    dueDate: assignment.dueDate || assignment.due_date,
                    points: assignment.points,
                    className: assignment.className || assignment.class_name || 'General',
                    url: assignment.url
                };
            } else {
                // Fallback
                assignmentData = {
                    title: assignment.name || 'Untitled Assignment',
                    dueDate: assignment.dueDate || assignment.due_date,
                    points: assignment.points || 'N/A',
                    className: assignment.className || assignment.class_name || 'General',
                    url: assignment.url || ''
                };
            }
            
            checkbox.dataset.assignment = JSON.stringify(assignmentData);
            checkbox.style.marginRight = '8px';
            
            const assignmentInfo = document.createElement('div');
            assignmentInfo.style.flex = '1';
            assignmentInfo.innerHTML = `
                <div style="font-weight: bold; color: #333;">${assignmentData.title}</div>
                <div style="color: #666; font-size: 11px;">
                    Due: ${assignmentData.dueDate || 'No due date'} | Points: ${assignmentData.points} | Class: ${assignmentData.className}
                </div>
            `;
            
            assignmentDiv.appendChild(checkbox);
            assignmentDiv.appendChild(assignmentInfo);
            assignmentsList.appendChild(assignmentDiv);
        });
    }

    // Helper function to update database status
    function updateDatabaseStatus(message) {
        const statusDiv = document.getElementById('databaseStatus');
        if (statusDiv) {
            statusDiv.textContent = message;
            statusDiv.style.color = message.includes('Error') ? '#dc3545' : '#28a745';
        }
    }

    // Show message helper
    function showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: 'MyFont', sans-serif;
            z-index: 1000;
            ${type === 'success' ? 'background: #d4edda; color: #155724; border: 1px solid #c3e6cb;' : 
              type === 'error' ? 'background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;' :
              'background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb;'}
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    // Function to add permanent course name input
    function addCourseNameInput() {
        const courseInputContainer = document.createElement('div');
        courseInputContainer.style.cssText = `
            margin-bottom: 15px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            border: 2px solid #8b48bc;
        `;
        
        courseInputContainer.innerHTML = `
            <label for="courseNameInput" style="display: block; margin-bottom: 5px; font-family: 'MyFont', sans-serif; font-weight: bold; color: #333;">Course Name:</label>
            <input type="text" id="courseNameInput" placeholder="Enter course name (e.g., CS 101)" style="width: 100%; padding: 8px; border: 2px solid #8b48bc; border-radius: 4px; font-family: 'MyFont', sans-serif; font-size: 14px; box-sizing: border-box;">
        `;
        
        // Insert the course input before the website display
        const websiteDisplay = document.getElementById("websiteDisplay");
        websiteDisplay.parentNode.insertBefore(courseInputContainer, websiteDisplay);
    }

    // Table button functionality - scrape assignments
    if (tableButton) {
        tableButton.addEventListener("click", async () => {
        if (!currentUrl) {
            alert("Could not retrieve the current website.");
            return;
        }
            
            // Check if course name is entered
            const courseNameInput = document.getElementById('courseNameInput');
            if (!courseNameInput || !courseNameInput.value.trim()) {
                showMessage('Please enter a course name first', 'error');
                return;
            }
            
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tabs[0].id },
                    func: () => {
                        function getColumnIndex(headers, keywords) {
                            for (let i = 0; i < headers.length; i++) {
                                const header = headers[i].toLowerCase();
                                for (const keyword of keywords) {
                                    if (header.includes(keyword)) return i;
                                }
                            }
                            return -1;
                        }
                        function looksLikeAnyDate(str) {
                            if (!str) return false;
                            str = str.trim().toLowerCase();
                            // Match month names, MM/DD, MM/DD/YYYY, YYYY-MM-DD, YYYY-MM-DD HH:MM:SS, etc.
                            return /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?\b/.test(str);
                        }
                        return Array.from(document.querySelectorAll('table')).map(table => {
                            const rows = Array.from(table.rows).map(row =>
                                Array.from(row.cells).map(cell => cell.innerText.trim())
                            );
                            if (rows.length < 2) return null;
                            const headers = rows[0];
                            const courseIdx = getColumnIndex(headers, ['course', 'class', 'section']);
                                const assignmentIdx = getColumnIndex(headers, ['assignment', 'name', 'title', 'problem', 'exam', 'details', 'lab', 'machine problem']);
                            const dueIdx = getColumnIndex(headers, ['due', 'date', 'deadline', 'submission']);
                            return rows.slice(1).map(row => {
                                let due_date = dueIdx !== -1 && row[dueIdx] ? row[dueIdx] : '';
                                if (!due_date) {
                                    // Scan all cells for a date-like value
                                    for (const cell of row) {
                                        if (looksLikeAnyDate(cell)) {
                                            due_date = cell;
                                            break;
                                        }
                                    }
                                }
                                return {
                                    course: courseIdx !== -1 && row[courseIdx] ? row[courseIdx] : '',
                                    assignment: assignmentIdx !== -1 && row[assignmentIdx] ? row[assignmentIdx] : '',
                                    due_date: due_date
                                };
                            });
                        }).filter(Boolean).flat();
                    }
                },
                (results) => {
                    const items = results && results[0] && results[0].result;
                    if (items && items.length) {
                            const courseName = courseNameInput.value.trim();
                            
                            // Update all items with the entered course name
                            const updatedItems = items.map(item => ({
                                ...item,
                                course: courseName
                            }));
                            
                            // Store the assignments for use with Google Calendar and Notion
                            window.scrapedAssignments = updatedItems;
                            
                            // Also store in Chrome storage for content script access
                            chrome.storage.local.set({ 'scrapedAssignments': updatedItems }, () => {
                                console.log('Scraped assignments stored in Chrome storage');
                            });
                            
                            // Send the scraped data directly to the content script
                            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    type: 'SCRAPED_ASSIGNMENTS_READY',
                                    assignments: updatedItems
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        console.log('Content script not ready yet:', chrome.runtime.lastError);
                                    } else {
                                        console.log('Scraped assignments sent to content script');
                                    }
                                });
                            });
                            
                            // Show success message and integration options
                            showMessage(`Successfully scraped ${items.length} assignments for ${courseName}!`, 'success');
                            
                            // Create integration buttons
                            createIntegrationButtons(updatedItems);
                    } else {
                            showMessage("No tables with the required columns found on the page.", 'error');
                        }
                }
            );
        });
    });
    }

    // Function to create integration buttons for scraped assignments
    function createIntegrationButtons(assignments) {
        // Remove any existing integration buttons
        const existingButtons = document.querySelectorAll('.integration-button');
        existingButtons.forEach(btn => btn.remove());
        
        // Create container for integration buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            border: 2px solid #8b48bc;
            text-align: center;
        `;
        
        buttonContainer.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333; font-family: 'MyFont', serif;">Add Scraped Assignments To:</h4>
            <button id="addToCalendarBtn" class="integration-button" style="font-family: 'MyFont', monospace; font-size: 14px; background-color: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; width: 100%; transition: background-color 0.3s ease;">Add to Google Calendar</button>
        `;
        
        // Insert the button container after the website input section
        const websiteInput = document.querySelector('.website-input');
        if (websiteInput) {
            websiteInput.parentNode.insertBefore(buttonContainer, websiteInput.nextSibling);
        }
        
        // Add event listener for the Google Calendar button
        document.getElementById('addToCalendarBtn').addEventListener('click', async () => {
            showMessage(`Adding ${assignments.length} assignments to Google Calendar...`, 'info');
            
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'ADD_TO_GOOGLE_CALENDAR',
                    assignments: assignments
                });
                
                if (response && response.success) {
                    showMessage(`Successfully added ${assignments.length} assignments to Google Calendar!`, 'success');
                } else {
                    showMessage(`Failed to add to calendar: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding to Google Calendar:", error);
                showMessage('Error adding to Google Calendar. Please check console for details.', 'error');
            }
        });
    }

    // Function to save JSON data to assignments.json
    function downloadJSON(data) {
        // Save to Chrome storage for persistence
        chrome.storage.local.set({ 'assignments.json': data }, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving to storage:', chrome.runtime.lastError);
                showMessage('Error saving assignments data', 'error');
            } else {
                showMessage('Assignments saved to assignments.json successfully!', 'success');
                console.log('Assignments saved:', data);
            }
        });
        
        // Also create a downloadable file as backup
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'assignments.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Background color cycle logic
    const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
    let currentBgIndex = 0;
    changeBgBtn.addEventListener("click", () => {
        currentBgIndex = (currentBgIndex + 1) % bgColors.length;
        const bottomColor = bgColors[currentBgIndex];
        document.body.style.backgroundImage = `linear-gradient(white, ${bottomColor})`;
    });
});
