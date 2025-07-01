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

    // Table button: scrape all tables, add to array, and immediately download as JSON
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
                        return Array.from(document.querySelectorAll('table')).map(table =>
                            Array.from(table.rows).map(row =>
                                Array.from(row.cells).map(cell => cell.innerText.trim())
                            )
                        );
                    }
                },
                (results) => {
                    const tables = results && results[0] && results[0].result;
                    if (tables && tables.length) {
                        // Display as HTML in popup
                        let html = '';
                        tables.forEach(table => {
                            html += '<table border="1" style="margin-bottom:10px;">';
                            table.forEach(row => {
                                html += '<tr>';
                                row.forEach(cell => {
                                    html += `<td>${cell}</td>`;
                                });
                                html += '</tr>';
                            });
                            html += '</table>';
                        });
                        websiteDisplay.innerHTML = html;
                        // Immediately download as JSON
                        downloadJSON(tables);
                    } else {
                        alert("No tables found on the page.");
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
