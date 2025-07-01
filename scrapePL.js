// scrapePL.js
(() => {
    // Find assignment rows
    const assignments = [];

    // Example PrairieLearn DOM scraping logic:
    const rows = document.querySelectorAll(".assignment-list-item"); // adjust based on actual site
    rows.forEach(row => {
        const title = row.querySelector(".assignment-title")?.innerText?.trim();
        const due = row.querySelector(".assignment-due-date")?.innerText?.trim();

        if (title && due) {
            assignments.push({ title, due });
        }
    });

    // Send results back to popup
    chrome.runtime.sendMessage({ type: "PL_ASSIGNMENTS", data: assignments });
})();
