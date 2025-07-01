document.addEventListener("DOMContentLoaded", function () {
    const loginButton = document.getElementById("loginButton");
    const websiteDisplay = document.getElementById("websiteDisplay");
    const changeBgBtn = document.getElementById("changeBgBtn");

    let currentUrl = "";

    // Display the current tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const currentTab = tabs[0];
        currentUrl = currentTab.url;
        websiteDisplay.textContent = currentUrl;
        websiteDisplay.title = currentUrl; // hover to see full URL
    });

    // Handle confirm button
    confirmButton.addEventListener("click", () => {
        if (!currentUrl.includes("prairielearn.com")) {
            alert("This site is not currently supported.");
            return;
        }

        // Inject the content script
        chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            files: ["scrapePrairieLearn.js"]
        });
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === "PL_ASSIGNMENTS") {
            const assignments = message.data;
            console.log("Received assignments:", assignments);
            alert(`Fetched ${assignments.length} assignments from PrairieLearn.`);

            // You can now pass these to Notion or show them in the UI
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
