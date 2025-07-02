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
            
            // Set up enhanced table scraping functionality
            setupEnhancedTableScraping();
            
            // Add permanent course name input
            addCourseNameInput();
        }
    });

    // Enhanced table scraping functionality from test_popup.js
    function setupEnhancedTableScraping() {
        // Handle confirm button: grab selected text on page
        if (confirmButton) {
            confirmButton.addEventListener("click", () => {
                if (!currentUrl) {
                    alert("Could not retrieve the current website.");
                    return;
                }
                chrome.scripting.executeScript(
                    {
                        target: { tabId: chrome.tabs.TAB_ID_CURRENT },
                        func: () => window.getSelection().toString(),
                    },
                    (results) => {
                        const phrase = results && results[0] && results[0].result ? results[0].result.trim() : '';
                        if (phrase) {
                            websiteDisplay.textContent = phrase;
                        } else {
                            alert("No phrase selected on the page.");
                        }
                    }
                );
            });
        }

        // Enhanced table button: map columns to course, assignment, and due date using header keywords
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
                                    const assignmentIdx = getColumnIndex(headers, ['assignment', 'name', 'title', 'problem', 'exam', 'details', 'machine_problem', 'lab']);
                                    const dueIdx = getColumnIndex(headers, ['due', 'date', 'deadline', 'submission', 'due_date']);
                                    const pointsIdx = getColumnIndex(headers, ['points', 'pts', 'score', 'weight']);
                                    const urlIdx = getColumnIndex(headers, ['url', 'link', 'href']);
                                    
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
                                        
                                        // Enhanced assignment object with more fields
                                        const assignment = {
                                            course: courseIdx !== -1 && row[courseIdx] ? row[courseIdx] : '',
                                            assignment: assignmentIdx !== -1 && row[assignmentIdx] ? row[assignmentIdx] : '',
                                            title: assignmentIdx !== -1 && row[assignmentIdx] ? row[assignmentIdx] : '',
                                            due_date: due_date,
                                            dueDate: due_date,
                                            points: pointsIdx !== -1 && row[pointsIdx] ? row[pointsIdx] : 'N/A',
                                            url: urlIdx !== -1 && row[urlIdx] ? row[urlIdx] : '',
                                            className: courseIdx !== -1 && row[courseIdx] ? row[courseIdx] : 'General',
                                            assignment_type: 'Assignment',
                                            description: assignmentIdx !== -1 && row[assignmentIdx] ? row[assignmentIdx] : '',
                                            difficulty: 'Intermediate',
                                            estimated_hours: 4,
                                            status: 'Not Started'
                                        };
                                        
                                        return assignment;
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
                                    course: courseName,
                                    className: courseName
                                }));
                                
                                // Store scraped assignments globally
                                scrapedAssignments = updatedItems;
                                
                                // Store in Chrome storage for content script access
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
                                
                                // Display as HTML in popup
                                let html = '<table border="1" style="margin-bottom:10px; width:100%; font-size:12px;"><tr><th>Course</th><th>Assignment</th><th>Due Date</th><th>Points</th></tr>';
                                updatedItems.forEach(item => {
                                    html += `<tr><td>${item.course}</td><td>${item.assignment}</td><td>${item.due_date}</td><td>${item.points}</td></tr>`;
                                });
                                html += '</table>';
                                websiteDisplay.innerHTML = html;
                                
                                // Show success message
                                showMessage(`Successfully scraped ${items.length} assignments for ${courseName}!`, 'success');
                                
                                // Create integration buttons
                                createIntegrationButtons(updatedItems);
                                
                                // Immediately download as JSON
                                downloadJSON(updatedItems);
                            } else {
                                alert("No tables with the required columns found on the page.");
                            }
                        }
                    );
                });
            });
        }
    }

    // Download JSON functionality from test_popup.js
    function downloadJSON(data, filename = "scraped_assignments.json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Background color cycle logic from test_popup.js
    const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
    let currentBgIndex = 0;
    if (changeBgBtn) {
        changeBgBtn.addEventListener("click", () => {
            currentBgIndex = (currentBgIndex + 1) % bgColors.length;
            document.body.style.backgroundImage = `linear-gradient(white, ${bgColors[currentBgIndex]})`;
        });
    }

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

    // Display assignments in the interface
    function displayAssignments(assignments) {
        const assignmentsList = document.getElementById('assignmentsList');
        assignmentsList.innerHTML = '';
        
        // Group assignments by class
        const assignmentsByClass = {};
        assignments.forEach(assignment => {
            const className = assignment.className || assignment.course || 'General';
            if (!assignmentsByClass[className]) {
                assignmentsByClass[className] = [];
            }
            assignmentsByClass[className].push(assignment);
        });
        
        // Create interface for each class
        Object.keys(assignmentsByClass).forEach(className => {
            const classAssignments = assignmentsByClass[className];
            
            // Class header
            const classHeader = document.createElement('div');
            classHeader.style.cssText = 'font-weight: bold; margin: 10px 0 5px 0; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px;';
            classHeader.textContent = className;
            assignmentsList.appendChild(classHeader);
            
            // Assignments for this class
            classAssignments.forEach(assignment => {
                const assignmentDiv = document.createElement('div');
                assignmentDiv.style.cssText = 'margin: 5px 0; padding: 8px; border: 1px solid #eee; border-radius: 4px; background: #f9f9f9;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.assignment = JSON.stringify(assignment);
                checkbox.style.marginRight = '8px';
                
                const assignmentInfo = document.createElement('span');
                assignmentInfo.style.cssText = 'font-size: 12px;';
                
                // Enhanced display with more information
                const title = assignment.title || assignment.assignment || assignment.machine_problem || 'Untitled';
                const dueDate = assignment.dueDate || assignment.due_date || 'No due date';
                const points = assignment.points || 'N/A';
                const type = assignment.assignment_type || 'Assignment';
                const difficulty = assignment.difficulty || 'Intermediate';
                const hours = assignment.estimated_hours || 'N/A';
                
                assignmentInfo.innerHTML = `
                    <strong>${title}</strong><br>
                    <small>Due: ${dueDate} | Points: ${points} | Type: ${type} | Difficulty: ${difficulty} | Est. Hours: ${hours}</small>
                `;
                
                assignmentDiv.appendChild(checkbox);
                assignmentDiv.appendChild(assignmentInfo);
                assignmentsList.appendChild(assignmentDiv);
            });
        });
    }

    // Update database status
    function updateDatabaseStatus(message) {
        const statusElement = document.getElementById('databaseStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    // Show message function
    function showMessage(message, type) {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        switch (type) {
            case 'success':
                toast.style.backgroundColor = '#28a745';
                break;
            case 'error':
                toast.style.backgroundColor = '#dc3545';
                break;
            case 'info':
                toast.style.backgroundColor = '#17a2b8';
                break;
            default:
                toast.style.backgroundColor = '#6c757d';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    // Function to add permanent course name input
    function addCourseNameInput() {
        const courseInputContainer = document.createElement('div');
        courseInputContainer.style.cssText = `
            margin: 15px 0;
            padding: 15px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            border: 2px solid #8b48bc;
            text-align: center;
        `;
        
        courseInputContainer.innerHTML = `
            <h4 style="margin: 0 0 15px 0; color: #333; font-family: 'MyFont', serif;">Course Information</h4>
            <input type="text" id="courseNameInput" placeholder="Enter course name (e.g., ECE 220)" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; font-family: 'MyFont', sans-serif;">
            <p style="font-size: 12px; color: #666; margin: 0;">Enter the course name to associate with scraped assignments</p>
        `;
        
        // Insert before the website display
        websiteDisplay.parentNode.insertBefore(courseInputContainer, websiteDisplay);
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
});
