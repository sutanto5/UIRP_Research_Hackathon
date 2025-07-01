document.addEventListener("DOMContentLoaded", function () {
    const loginButton = document.getElementById("loginButton");
    const websiteDisplay = document.getElementById("websiteDisplay");
    const changeBgBtn = document.getElementById("changeBgBtn");
    const confirmButton = document.getElementById("confirmButton");

    let currentUrl = "";

    // Display the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        currentUrl = currentTab.url;
        websiteDisplay.textContent = currentUrl;
        websiteDisplay.title = currentUrl; // hover to see full URL
        
        // Check if we're on a Notion page
        const isNotionPage = currentUrl && currentUrl.includes('notion.so');
        
        if (isNotionPage) {
            // Replace with Notion interface
            showNotionInterface();
        } else {
            // Keep original interface
            showOriginalInterface();
        }
    });

    function showOriginalInterface() {
        // Keep the original interface as is - no changes needed
        console.log("Showing original interface for non-Notion page");
    }

    function showNotionInterface() {
        console.log("Showing Notion interface");
        
        // Replace the entire body content with Notion interface
        document.body.innerHTML = `
            <h1>UniTion</h1>
            <p><i>Unifying Your Assignments Into Notion.</i></p>

            <div class="change-bg-container">
                <button id="changeBgBtn"> 🔄 🖼️</button>
            </div>

            <div style="margin-top: 20px; padding: 15px; background: rgba(255, 255, 255, 0.9); border-radius: 8px; border: 2px solid #8b48bc;">
                <h4 style="margin: 0 0 10px 0; color: #333; font-family: 'MyFont', serif;">📚 Notion Assignment Management</h4>
                
                <div style="margin-bottom: 10px; padding: 8px; border-radius: 4px; background: #d4edda; border: 1px solid #c3e6cb;">
                    <small style="color: #155724; font-family: 'MyFont', sans-serif;">✅ Notion Connected</small>
                </div>
                
                <button id="createDatabaseBtn" style="width: 100%; margin-bottom: 8px;">Create Assignment Database</button>
                
                <div style="margin-top: 15px; padding: 15px; background: rgba(139, 72, 188, 0.1); border-radius: 8px; border: 1px solid #8b48bc;">
                    <h5 style="margin: 0 0 10px 0; color: #333; font-family: 'MyFont', serif;">📋 ECE220 Assignments</h5>
                    <button id="viewAssignmentsBtn" style="width: 100%; margin-bottom: 10px;">View ECE220 Assignments</button>
                    
                    <div id="assignmentsInterface" style="display: none;">
                        <div style="margin-bottom: 10px;">
                            <button id="selectAllBtn" style="width: 48%; margin-right: 2%; font-size: 12px;">Select All</button>
                            <button id="deselectAllBtn" style="width: 48%; margin-left: 2%; font-size: 12px;">Deselect All</button>
                        </div>
                        
                        <div id="assignmentsList" style="max-height: 150px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: white; margin-bottom: 10px;">
                            <!-- Assignments will be loaded here -->
                        </div>
                        
                        <button id="addSelectedBtn" style="width: 100%; font-size: 12px;">Add Selected Assignments</button>
                    </div>
                </div>
            </div>
        `;

        // Add event listeners for the new elements
        setupNotionEventListeners();
    }

    function setupNotionEventListeners() {
        // Background color cycle logic (preserved from original)
        const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
        let currentBgIndex = 0;
        document.getElementById('changeBgBtn').addEventListener('click', () => {
            currentBgIndex = (currentBgIndex + 1) % bgColors.length;
            const bottomColor = bgColors[currentBgIndex];
            document.body.style.backgroundImage = `linear-gradient(white, ${bottomColor})`;
        });

        // Create Database button
        document.getElementById('createDatabaseBtn').addEventListener('click', () => {
            console.log("Create Database button clicked!");
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                console.log("Sending CREATE_DATABASE message to tab:", tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, { type: 'CREATE_DATABASE' }, (response) => {
                    console.log("CREATE_DATABASE response from content script:", response);
                    if (response && response.success) {
                        showMessage('Database created successfully!', 'success');
                    } else if (response && response.error) {
                        showMessage(`Database creation failed: ${response.error}`, 'error');
                    }
                });
            });
            showMessage('Creating new database...', 'info');
        });

        // View assignments button
        document.getElementById('viewAssignmentsBtn').addEventListener('click', async () => {
            const assignmentsInterface = document.getElementById('assignmentsInterface');
            
            if (assignmentsInterface.style.display === 'none') {
                // Load assignments from data.json
                try {
                    const response = await fetch(chrome.runtime.getURL('data.json'));
                    const data = await response.json();
                    
                    if (data && data.length > 0) {
                        // Display assignments
                        displayAssignments(data);
                        
                        // Show interface
                        assignmentsInterface.style.display = 'block';
                        document.getElementById('viewAssignmentsBtn').textContent = 'Hide Assignments';
                    } else {
                        showMessage('No assignments found', 'error');
                    }
                } catch (error) {
                    showMessage('Error loading assignments', 'error');
                }
            } else {
                // Hide interface
                assignmentsInterface.style.display = 'none';
                document.getElementById('viewAssignmentsBtn').textContent = 'View ECE220 Assignments';
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

            showMessage(`Adding ${selectedAssignments.length} assignments...`, 'info');
            
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
                    
                    showMessage(`Successfully added ${selectedAssignments.length} assignments!`, 'success');
                } else {
                    showMessage(`Failed to add assignments: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("Error adding assignments:", error);
                showMessage('Error adding assignments. Please check console for details.', 'error');
            }
        });
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
            checkbox.dataset.assignment = JSON.stringify({
                title: assignment.machine_problem,
                dueDate: assignment.due_date,
                points: assignment.points,
                className: 'ECE220',
                url: assignment.url
            });
            checkbox.style.marginRight = '8px';
            
            const assignmentInfo = document.createElement('div');
            assignmentInfo.style.flex = '1';
            assignmentInfo.innerHTML = `
                <div style="font-weight: bold; color: #333;">${assignment.machine_problem}</div>
                <div style="color: #666; font-size: 11px;">
                    Due: ${assignment.due_date} | Points: ${assignment.points}
                </div>
            `;
            
            assignmentDiv.appendChild(checkbox);
            assignmentDiv.appendChild(assignmentInfo);
            assignmentsList.appendChild(assignmentDiv);
        });
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

    // Original functionality (for non-Notion pages)
    // Handle confirm button
    confirmButton.addEventListener("click", () => {
        if (currentUrl) {
            console.log("Confirmed URL:", currentUrl);
            // Replace this with your actual scrape/init logic
            alert("Fetching assignments from:\n" + currentUrl);
        } else {
            alert("Could not retrieve the current website.");
        }
    });

    // Background color cycle logic
    const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
    let currentBgIndex = 0;
    changeBgBtn.addEventListener("click", () => {
        currentBgIndex = (currentBgIndex + 1) % bgColors.length;
        const bottomColor = bgColors[currentBgIndex];
        document.body.style.backgroundImage = `linear-gradient(white, ${bottomColor})`;
    });

    // Login functionality
    loginButton.addEventListener("click", function () {
        logIn();
    });

    function logIn() {
        alert("Login flow goes here!");
    }
}); 