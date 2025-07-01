document.addEventListener("DOMContentLoaded", function () {
    const loginButton      = document.getElementById("loginButton");
    const websiteDisplay   = document.getElementById("websiteDisplay");
    const changeBgBtn      = document.getElementById("changeBgBtn");
    const confirmButton    = document.getElementById("confirmButton");
    const tableButton      = document.getElementById("tableButton");
    let currentUrl = "";

    // Display the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        currentUrl = currentTab.url;
        websiteDisplay.textContent = currentUrl;
        websiteDisplay.title       = currentUrl;
    });

    // Handle confirm button: grab selected text on page
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

    // Table button: map columns to course, assignment, and due date using header keywords, and if due date is empty, scan all cells for a date-like value
    tableButton.addEventListener("click", () => {
        if (!currentUrl) {
            alert("Could not retrieve the current website.");
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
                            const assignmentIdx = getColumnIndex(headers, ['assignment', 'name', 'title', 'problem', 'exam', 'details']);
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
                        // Display as HTML in popup
                        let html = '<table border="1" style="margin-bottom:10px;"><tr><th>Course</th><th>Assignment</th><th>Due Date</th></tr>';
                        items.forEach(item => {
                            html += `<tr><td>${item.course}</td><td>${item.assignment}</td><td>${item.due_date}</td></tr>`;
                        });
                        html += '</table>';
                        websiteDisplay.innerHTML = html;
                        // Immediately download as JSON
                        downloadJSON(items);
                    } else {
                        alert("No tables with the required columns found on the page.");
                    }
                }
            );
        });
    });

    function downloadJSON(data, filename = "tables.json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Background color cycle logic
    const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
    let currentBgIndex = 0;
    changeBgBtn.addEventListener("click", () => {
        currentBgIndex = (currentBgIndex + 1) % bgColors.length;
        document.body.style.backgroundImage = `linear-gradient(white, ${bgColors[currentBgIndex]})`;
    });

    // Login functionality (stub)
    loginButton.addEventListener("click", function () {
        logIn();
    });

    function logIn() {
        alert("Login flow goes here!");
    }
});
