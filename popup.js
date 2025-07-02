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
    
                                    return /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}:\d{2})?\b/.test(str);
    
                                }
    
     
    
                                function cleanDate(raw) {
    
                                    if (!raw) return null;
    
                                    raw = raw.split('(')[0].trim(); // Remove anything in parentheses
    
     
    
                                    const [month, day] = raw.split('/').map(s => parseInt(s.trim()));
    
                                    if (!month || !day) return null;
    
     
    
                                    const year = 2025; // Change if needed
    
                                    const monthStr = String(month).padStart(2, '0');
    
                                    const dayStr = String(day).padStart(2, '0');
    
     
    
                                    return `${year}-${monthStr}-${dayStr}T23:59:00`;
    
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
    
                                        let due_date_raw = dueIdx !== -1 && row[dueIdx] ? row[dueIdx] : '';
    
                                        if (!due_date_raw) {
    
                                            for (const cell of row) {
    
                                                if (looksLikeAnyDate(cell)) {
    
                                                    due_date_raw = cell;
    
                                                    break;
    
                                                }
    
                                            }
    
                                        }
    
     
    
                                        return {
    
                                            course: courseIdx !== -1 && row[courseIdx] ? row[courseIdx] : '',
    
                                            assignment: assignmentIdx !== -1 && row[assignmentIdx] ? row[assignmentIdx] : '',
    
                                            due_date: cleanDate(due_date_raw)
    
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
        console.log("Showing Notion interface");
        // Replace the entire body content with Notion interface
        document.body.innerHTML = `
            <h1>UniTion</h1>
            <p><i>Unifying Your Assignments Into Notion.</i></p>

            <div style="margin-top: 20px; padding: 15px; background: rgba(255, 255, 255, 0.9); border-radius: 8px; border: 2px solid #8b48bc;">
                <h4 style="margin: 0 0 10px 0; color: #333; font-family: 'MyFont', serif;">📚 Notion Assignment Management</h4>
                <div style="margin-bottom: 10px; padding: 8px; border-radius: 4px; background: #d4edda; border: 1px solid #c3e6cb;">
                    <small style="color: #155724; font-family: 'MyFont', sans-serif;">✅ Notion Connected</small>
                </div>
                <button id="createDatabaseBtn" style="width: 100%; margin-bottom: 8px;">Create Assignment Database</button>
                <div style="margin-top: 15px; padding: 15px; background: rgba(139, 72, 188, 0.1); border-radius: 8px; border: 1px solid #8b48bc;">
                    <h5 style="margin: 0 0 10px 0; color: #333; font-family: 'MyFont', serif;">📋 Assignment List</h5>
                    <button id="viewAssignmentsBtn" style="width: 100%; margin-bottom: 10px;">View Assignments</button>
                    <div id="assignmentsInterface" style="display: none;">
                        <div style="margin-bottom: 10px;">
                            <label for="classDropdown" style="font-size: 12px; margin-right: 8px;">Class:</label>
                            <select id="classDropdown" style="font-size: 12px; margin-right: 8px;"></select>
                        </div>
                        <div style="margin-bottom: 10px;">
                            <button id="selectAllBtn" style="width: 48%; margin-right: 2%; font-size: 12px;">Select All</button>
                            <button id="deselectAllBtn" style="width: 48%; margin-left: 2%; font-size: 12px;">Deselect All</button>
                        </div>
                        <div id="assignmentsList" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: white; margin-bottom: 10px;"></div>
                        <button id="addSelectedBtn" style="width: 100%; font-size: 12px;">Add Selected Assignments</button>
                        <button id="addToCalendarBtn" style="width: 100%; font-size: 12px; margin-top: 6px; background: #007bff; color: white; border: none; border-radius: 4px;">Add Selected to Google Calendar</button>
                    </div>
                </div>
            </div>
        `;
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
            const assignmentsInterface = document.getElementById('assignmentsInterface');
            if (assignmentsInterface.style.display === 'none') {
                try {
                    const response = await fetch(chrome.runtime.getURL('data.json'));
                    const data = await response.json();
                    if (data && data.length > 0) {
                        // Extract unique class names for dropdown
                        const classSet = new Set();
                        data.forEach(a => {
                            if (a.className) classSet.add(a.className);
                            else if (a.course) classSet.add(a.course);
                            else classSet.add('ECE220');
                        });
                        const classList = Array.from(classSet);
                        const classDropdown = document.getElementById('classDropdown');
                        classDropdown.innerHTML = '';
                        classList.forEach(cls => {
                            const opt = document.createElement('option');
                            opt.value = cls;
                            opt.textContent = cls;
                            classDropdown.appendChild(opt);
                        });
                        // Display assignments
                        displayAssignments(data, classDropdown.value);
                        // Update assignments when dropdown changes
                        classDropdown.addEventListener('change', () => {
                            displayAssignments(data, classDropdown.value);
                        });
                        assignmentsInterface.style.display = 'block';
                        document.getElementById('viewAssignmentsBtn').textContent = 'Hide Assignments';
                    } else {
                        showMessage('No assignments found', 'error');
                    }
                } catch (error) {
                    showMessage('Error loading assignments', 'error');
                }
            } else {
                assignmentsInterface.style.display = 'none';
                document.getElementById('viewAssignmentsBtn').textContent = 'View Assignments';
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

        // Add selected assignments button
        document.getElementById('addSelectedBtn').addEventListener('click', async () => {
            const classDropdown = document.getElementById('classDropdown');
            const selectedClass = classDropdown.value;
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                showMessage('Please select at least one assignment', 'error');
                return;
            }
            const selectedAssignments = [];
            const selectedCheckboxes = [];
            checkboxes.forEach(checkbox => {
                let assignmentData = JSON.parse(checkbox.dataset.assignment);
                // Always map to correct format and fix date
                let dueDateRaw = assignmentData.due_date || assignmentData.dueDate || '';
                let dueDate = '';
                if (dueDateRaw) {
                    // Try to parse MM/DD or MM/DD/YYYY or YYYY-MM-DD
                    let parsedDate = null;
                    if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(dueDateRaw)) {
                        const parts = dueDateRaw.split('/');
                        if (parts.length === 2) {
                            // MM/DD, assume current year
                            const year = new Date().getFullYear();
                            parsedDate = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
                        } else if (parts.length === 3) {
                            // MM/DD/YYYY
                            parsedDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
                        }
                    } else if (/^\d{4}-\d{2}-\d{2}/.test(dueDateRaw)) {
                        parsedDate = new Date(dueDateRaw);
                    } else {
                        parsedDate = new Date(dueDateRaw);
                    }
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        dueDate = parsedDate.toISOString().split('T')[0];
                    }
                }
                assignmentData = {
                    title: assignmentData.machine_problem || assignmentData.title || assignmentData.assignment || 'Untitled',
                    dueDate: dueDate,
                    points: assignmentData.points || '',
                    className: selectedClass,
                    url: assignmentData.url || ''
                };
                selectedAssignments.push(assignmentData);
                selectedCheckboxes.push(checkbox);
            });
            showMessage(`Adding ${selectedAssignments.length} assignments...`, 'info');
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            try {
                const response = await chrome.tabs.sendMessage(currentTab.id, {
                    type: 'ADD_MULTIPLE_ASSIGNMENTS',
                    assignments: selectedAssignments
                });
                if (response && response.success) {
                    selectedCheckboxes.forEach(checkbox => {
                        const assignmentDiv = checkbox.closest('div');
                        if (assignmentDiv) {
                            assignmentDiv.remove();
                        }
                    });
                    showMessage(`Successfully added ${selectedAssignments.length} assignments!`, 'success');
                } else {
                    console.error('Failed to add assignments:', response);
                    showMessage(`Failed to add assignments: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding assignments:", error);
                showMessage('Error adding assignments. Please check console for details.', 'error');
            }
        });

        // Add selected assignments to Google Calendar button
        document.getElementById('addToCalendarBtn').addEventListener('click', async () => {
            const classDropdown = document.getElementById('classDropdown');
            const selectedClass = classDropdown.value;
            const checkboxes = document.querySelectorAll('#assignmentsList input[type="checkbox"]:checked');
            if (checkboxes.length === 0) {
                showMessage('Please select at least one assignment', 'error');
                return;
            }
            const selectedAssignments = [];
            checkboxes.forEach(checkbox => {
                let assignmentData = JSON.parse(checkbox.dataset.assignment);
                // Always map to correct format and fix date
                let dueDateRaw = assignmentData.due_date || assignmentData.dueDate || '';
                let dueDate = '';
                if (dueDateRaw) {
                    let parsedDate = null;
                    if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(dueDateRaw)) {
                        const parts = dueDateRaw.split('/');
                        if (parts.length === 2) {
                            const year = new Date().getFullYear();
                            parsedDate = new Date(year, parseInt(parts[0]) - 1, parseInt(parts[1]));
                        } else if (parts.length === 3) {
                            parsedDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
                        }
                    } else if (/^\d{4}-\d{2}-\d{2}/.test(dueDateRaw)) {
                        parsedDate = new Date(dueDateRaw);
                    } else {
                        parsedDate = new Date(dueDateRaw);
                    }
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        dueDate = parsedDate.toISOString().split('T')[0];
                    }
                }
                assignmentData = {
                    title: assignmentData.machine_problem || assignmentData.title || assignmentData.assignment || 'Untitled',
                    dueDate: dueDate,
                    points: assignmentData.points || '',
                    className: selectedClass,
                    url: assignmentData.url || ''
                };
                selectedAssignments.push(assignmentData);
            });
            showMessage(`Adding ${selectedAssignments.length} assignments to Google Calendar...`, 'info');
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'ADD_TO_GOOGLE_CALENDAR',
                    assignments: selectedAssignments
                });
                if (response && response.success) {
                    showMessage(`Successfully added ${selectedAssignments.length} assignments to Google Calendar!`, 'success');
                } else {
                    console.error('Failed to add to calendar:', response);
                    showMessage(`Failed to add to calendar: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding to Google Calendar:", error);
                showMessage('Error adding to Google Calendar. Please check console for details.', 'error');
            }
        });
    }

    function displayAssignments(assignments, selectedClass) {
        const assignmentsList = document.getElementById('assignmentsList');
        assignmentsList.innerHTML = '';
        assignments.filter(a => {
            const cls = a.className || a.course || 'ECE220';
            return !selectedClass || cls === selectedClass;
        }).forEach((assignment, index) => {
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
            checkbox.dataset.assignment = JSON.stringify(assignment);
            checkbox.style.marginRight = '8px';
            const assignmentInfo = document.createElement('div');
            assignmentInfo.style.flex = '1';
            assignmentInfo.innerHTML = `
                <div style="font-weight: bold; color: #333;">${assignment.machine_problem || assignment.title || assignment.assignment || 'Untitled'}</div>
                <div style="color: #666; font-size: 11px;">
                    Due: ${assignment.due_date || assignment.dueDate || ''} | Points: ${assignment.points || ''}
                </div>
            `;
            assignmentDiv.appendChild(checkbox);
            assignmentDiv.appendChild(assignmentInfo);
            assignmentsList.appendChild(assignmentDiv);
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
