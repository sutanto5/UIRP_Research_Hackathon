// Merged popup.js

// Utility: Get Google Auth Token
function getGoogleAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: "getAuthToken" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response.error) {
        reject(new Error(response.error));
      } else {
        resolve(response.token);
      }
    });
  });
}

// Add Assignments to Google Calendar
async function addToCalendar(assignments) {
  const token = await getGoogleAuthToken();
  for (const item of assignments) {
    try {
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: `${item.course}: ${item.assignment}`,
          description: "Imported from course website",
          start: { dateTime: item.due, timeZone: "America/Chicago" },
          end: { dateTime: item.due, timeZone: "America/Chicago" },
          reminders: { useDefault: true }
        })
      });

      const result = await response.json();
      if (response.ok) {
        console.log("Event created:", result.summary);
      } else {
        console.error("Failed to create event:", result);
      }
    } catch (err) {
      console.error("Error adding to calendar:", err);
    }
  }
}

// DOM Loaded Handler
function initializePopup() {
  const loginButton    = document.getElementById("loginButton");
  const websiteDisplay = document.getElementById("websiteDisplay");
  const changeBgBtn    = document.getElementById("changeBgBtn");
  const confirmButton  = document.getElementById("confirmButton");
  const tableButton    = document.getElementById("tableButton");
  const addCalendarBtn = document.getElementById("add-calendar");

  let currentUrl = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    currentUrl = currentTab.url;
    websiteDisplay.textContent = currentUrl;
    websiteDisplay.title = currentUrl;

    const isNotionPage = currentUrl.includes("notion.so");
    if (isNotionPage) {
      showNotionInterface();
    } else {
      showOriginalInterface();
    }
  });

  function showOriginalInterface() {
    console.log("Showing original interface for non-Notion page");
  }

  function showNotionInterface() {
    // Notion interface HTML and logic here (see full file for details)
    console.log("Showing Notion interface");
  }

  function changeBackground() {
    const bgColors = ["skyblue", "#f6f9da", "#ffe0b2", "#e1bee7", "#dcedc8", "pink"];
    let currentBgIndex = 0;
    return () => {
      currentBgIndex = (currentBgIndex + 1) % bgColors.length;
      document.body.style.backgroundImage = `linear-gradient(white, ${bgColors[currentBgIndex]})`;
    };
  }

  if (changeBgBtn) {
    changeBgBtn.addEventListener("click", changeBackground());
  }

  if (loginButton) {
    loginButton.addEventListener("click", () => alert("Login flow goes here!"));
  }

  if (confirmButton) {
    confirmButton.addEventListener("click", () => {
      if (!currentUrl) {
        alert("Could not retrieve the current website.");
        return;
      }
      alert("Fetching assignments from:\n" + currentUrl);
    });
  }

  if (addCalendarBtn) {
    addCalendarBtn.addEventListener("click", async () => {
      try {
        const res = await fetch(chrome.runtime.getURL("assignment.json"));
        const assignments = await res.json();
        console.log("✅ Loaded assignments:", assignments);
        await addToCalendar(assignments);
      } catch (err) {
        console.error("❌ Failed to load or add to calendar:", err);
      }
    });
  }

  if (tableButton) {
    tableButton.addEventListener("click", () => {
      if (!currentUrl) {
        alert("Could not retrieve the current website.");
        return;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            function getColumnIndex(headers, keywords) {
              for (let i = 0; i < headers.length; i++) {
                const header = headers[i].toLowerCase();
                if (keywords.some(keyword => header.includes(keyword))) return i;
              }
              return -1;
            }
            function looksLikeAnyDate(str) {
              return /(?:jan|feb|...|dec)[a-z]*|\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}/i.test(str);
            }
            return Array.from(document.querySelectorAll('table')).flatMap(table => {
              const rows = Array.from(table.rows).map(r => Array.from(r.cells).map(c => c.innerText.trim()));
              if (rows.length < 2) return [];
              const headers = rows[0];
              const [cIdx, aIdx, dIdx] = [
                getColumnIndex(headers, ['course', 'class']),
                getColumnIndex(headers, ['assignment', 'title']),
                getColumnIndex(headers, ['due', 'date'])
              ];
              return rows.slice(1).map(row => ({
                course: row[cIdx] || '',
                assignment: row[aIdx] || '',
                due_date: row[dIdx] || row.find(looksLikeAnyDate) || ''
              }));
            });
          }
        }, (results) => {
          const items = results?.[0]?.result || [];
          if (items.length) {
            let html = '<table border="1"><tr><th>Course</th><th>Assignment</th><th>Due Date</th></tr>';
            html += items.map(i => `<tr><td>${i.course}</td><td>${i.assignment}</td><td>${i.due_date}</td></tr>`).join('');
            html += '</table>';
            websiteDisplay.innerHTML = html;
            const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tables.json';
            a.click();
            URL.revokeObjectURL(url);
          } else {
            alert("No tables with the required columns found on the page.");
          }
        });
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
