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
