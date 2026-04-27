document.getElementById("saveBtn").addEventListener("click", () => {

let key = document.getElementById("apikey").value.trim();

chrome.storage.local.set({
groq_api_key:key
}, () => {
document.getElementById("msg").innerText = "API Key Saved Successfully!";
});

});