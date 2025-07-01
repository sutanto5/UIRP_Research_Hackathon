console.log("This is a popup!")

const DECAY_PER_SECOND = 0.05;
const MAX_HAPPINESS = 100;
const MIN_HAPPINESS = 0;

document.addEventListener("DOMContentLoaded", function () {
    const inputBox = document.getElementById("inputBox");
    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");

    const now = Date.now();

    // function to log in
    function logIn() {

    };

    // function to sign up
    function signUp() {

    };

    // listeners for logging in or signing up
    loginButton.addEventListener("click", function () {
        logIn();
    });

    signupButton.addEventListener("click", function () {
        signUp()
    });

    const bgColors = ["#f6f9da", "#e3f2fd", "#ffe0b2", "#e1bee7", "#dcedc8"];
    let currentBgIndex = 0;

    changeBgBtn.addEventListener("click", () => {
        currentBgIndex = (currentBgIndex + 1) % bgColors.length;
        document.body.style.backgroundColor = bgColors[currentBgIndex];
    });

});

window.addEventListener('pagehide', () => {
    chrome.storage.local.set({ lastClosedTime: Date.now() });
});