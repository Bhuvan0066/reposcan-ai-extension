document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["github_token", "groq_api_key"], (result) => {
    if (result.github_token) {
      document.getElementById("ghtoken").value = result.github_token;
    }
    if (result.groq_api_key) {
      document.getElementById("apikey").value = result.groq_api_key;
    }
  });
});

document.getElementById("saveBtn").addEventListener("click", () => {
  let ghToken = document.getElementById("ghtoken").value.trim();
  let groqKey = document.getElementById("apikey").value.trim();

  chrome.storage.local.set({
    github_token: ghToken,
    groq_api_key: groqKey
  }, () => {
    document.getElementById("msg").innerText = "Settings Saved Successfully!";
  });
});