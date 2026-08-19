chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.type === "scan_repo") {
    scanRepo(req.repo).then(sendResponse);
    return true;
  }


  if (req.type === "fix_issue") {
    (async () => {
      try {
        const storageData = await chrome.storage.local.get("groq_api_key");
        const groqKey = storageData.groq_api_key ? storageData.groq_api_key.trim() : "";

        if (!groqKey) {
          sendResponse({
            error: "MISSING_GROQ_KEY",
            result: "⚠️ Please add your Groq API Key in the extension popup before using AI features."
          });
          return;
        }

        const res = await fetch("https://reposcan-backend-clean.onrender.com/fix", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            issue: req.issue,
            groq_api_key: groqKey
          })
        });

        const data = await res.json();
        sendResponse({
          result: data.result || data.error || "Backend fix failed."
        });
      } catch (err) {
        sendResponse({
          result: `❌ Backend fix failed: ${err.message || "Server error."}`
        });
      }
    })();
    return true;
  }

  if (req.type === "generate_readme") {
    (async () => {
      try {
        const storageData = await chrome.storage.local.get("groq_api_key");
        const groqKey = storageData.groq_api_key ? storageData.groq_api_key.trim() : "";

        if (!groqKey) {
          sendResponse({
            error: "MISSING_GROQ_KEY",
            result: "⚠️ Please add your Groq API Key in the extension popup before using AI features."
          });
          return;
        }

        const res = await fetch("https://reposcan-backend-clean.onrender.com/readme", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            repo: req.repo,
            groq_api_key: groqKey
          })
        });

        const data = await res.json();
        sendResponse({
          result: data.result || data.error || "README generation failed."
        });
      } catch (err) {
        sendResponse({
          result: `❌ README failed: ${err.message || "Server error."}`
        });
      }
    })();
    return true;
  }


  if (req.type === "generate_commit") {
    (async () => {
      try {
        const storageData = await chrome.storage.local.get("groq_api_key");
        const groqKey = storageData.groq_api_key ? storageData.groq_api_key.trim() : "";

        if (!groqKey) {
          sendResponse({
            error: "MISSING_GROQ_KEY",
            result: "⚠️ Please add your Groq API Key in the extension popup before using AI features."
          });
          return;
        }

        const res = await fetch("https://reposcan-backend-clean.onrender.com/commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            repo: req.repo,
            groq_api_key: groqKey
          })
        });

        const data = await res.json();
        sendResponse({
          result: data.result || data.error || "Commit generation failed."
        });
      } catch (err) {
        sendResponse({
          result: `❌ Commit generation failed: ${err.message || "Server error."}`
        });
      }
    })();
    return true;
  }

});

async function scanRepo(repo) {

  try {

    let output = "";

    const storageData = await chrome.storage.local.get("github_token");
    const token = storageData.github_token ? storageData.github_token.trim() : "";

    const headers = {
      "Accept": "application/vnd.github.v3+json"
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Resolve default branch
    let defaultBranch = "HEAD";
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (repoRes.ok) {
      const repoData = await repoRes.json();
      if (repoData && repoData.default_branch) {
        defaultBranch = repoData.default_branch;
      }
    } else {
      const errData = await repoRes.json().catch(() => ({}));
      const msg = errData.message || `GitHub API error (${repoRes.status}).`;
      const tokenHint = token ? "" : "\nAdd a GitHub token in the popup for higher scan limits.";
      return {
        result: `❌ Scan failed: ${msg}${tokenHint}`
      };
    }

    // Fetch recursive tree
    const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers });
    const treeData = await treeRes.json();

    if (!treeRes.ok || !treeData || !Array.isArray(treeData.tree)) {
      const errMsg = (treeData && treeData.message) ? treeData.message : "GitHub API error";
      const tokenHint = token ? "" : "\nAdd a GitHub token in the popup for higher scan limits.";
      return {
        result: `❌ Scan failed: ${errMsg}${tokenHint}`
      };
    }

    const tree = treeData.tree;

    const validExtensions = [".py", ".js", ".ts", ".txt", ".json"];
    const matchingFiles = tree.filter(file => {
      if (file.type !== "blob") return false;
      const pathLower = file.path.toLowerCase();
      const matchesExt = validExtensions.some(ext => pathLower.endsWith(ext));
      if (!matchesExt) return false;
      if (file.size && file.size > 200000) return false; // Skip files > 200KB
      return true;
    });

    const filesToScan = matchingFiles.slice(0, 150); // Cap total files scanned at 150

    for (const file of filesToScan) {

      const rawUrl = `https://raw.githubusercontent.com/${repo}/${defaultBranch}/${file.path}`;
      const rawRes = await fetch(rawUrl);
      if (!rawRes.ok) continue;

      const code = await rawRes.text();
      const lines = code.split("\n");

      lines.forEach((line, index) => {

        const n = index + 1;

        /* Python */

        if (line.includes("except:")) {
          output += `${file.path} | line ${n} | error | Broad except hides real errors\n`;
        }

        /* Secrets */

        if (
          line.includes("api_key") ||
          line.includes("API_KEY") ||
          line.includes("sk-")
        ) {
          output += `${file.path} | line ${n} | critical | Possible hardcoded secret\n`;
        }

        /* JS */

        if (line.includes("console.log(")) {
          output += `${file.path} | line ${n} | warning | Debug console.log found\n`;
        }

        /* requirements */

        const fileNameOnly = file.path.split("/").pop();
        if (
          fileNameOnly === "requirements.txt" &&
          line.trim() &&
          !line.trim().startsWith("#") &&
          !line.trim().startsWith("-") &&
          !line.includes("==")
        ) {
          output += `${file.path} | line ${n} | notice | Package version not pinned\n`;
        }

      });

    }

    if (!output.trim()) {
      output = "✅ No major issues found.";
    }

    if (!token) {
      output += "\n\n💡 Tip: Add a GitHub token in the popup for higher scan limits.";
    }

    return {
      result: output
    };

  } catch (e) {

    let tokenHint = "";
    try {
      const storageData = await chrome.storage.local.get("github_token");
      if (!storageData || !storageData.github_token) {
        tokenHint = "\nAdd a GitHub token in the popup for higher scan limits.";
      }
    } catch (_) {}

    return {
      result: `❌ Scan failed: ${e.message || "Unknown error."}${tokenHint}`
    };

  }

}