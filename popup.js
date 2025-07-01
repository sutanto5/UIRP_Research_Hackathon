// Request from background
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

//adding to calander
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
          start: {
            dateTime: item.due,
            timeZone: "America/Chicago"
          },
          end: {
            dateTime: item.due,
            timeZone: "America/Chicago"
          },
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
//pressing button
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("add-calendar");

  if (!btn) {
    console.error("❌ Button not found");
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      // Load assignments from local JSON
      const res = await fetch(chrome.runtime.getURL("assignment.json"));
      const assignments = await res.json();

      console.log("✅ Loaded assignments:", assignments);

      // Add to calendar
      await addToCalendar(assignments);
    } catch (err) {
      console.error("❌ Failed to load or add to calendar:", err);
    }
  });
});

