chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.type === "scan_repo") {
    scanRepo(req.repo).then(sendResponse);
    return true;
  }


  if (req.type === "fix_issue") {

    fetch("https://reposcan-backend-clean.onrender.com/fix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issue: req.issue
      })
    })
    .then(res => res.json())
    .then(data => {
      sendResponse({
        result: data.result
      });
    })
    .catch(err => {
      sendResponse({
        result: "❌ Backend fix failed."
      });
    });

    return true;
  }

  if (req.type === "generate_readme") {

    fetch("https://reposcan-backend-clean.onrender.com/readme", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        repo: req.repo
      })
    })
    .then(res => res.json())
    .then(data => {
      sendResponse({
        result: data.result
      });
    })
    .catch(() => {
      sendResponse({
        result: "README failed."
      });
    });

    return true;
  }


  if (req.type === "generate_commit") {

    fetch("https://reposcan-backend-clean.onrender.com/commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        repo: req.repo
      })
    })
    .then(res => res.json())
    .then(data => {
      sendResponse({
        result: data.result
      });
    })
    .catch(() => {
      sendResponse({
        result: "Commit generation failed."
      });
    });

    return true;
  }

});

async function scanRepo(repo) {

  try {

    let output = "";

    const url = `https://api.github.com/repos/${repo}/contents`;

    const res = await fetch(url);
    const files = await res.json();

    for (const file of files) {

      if (file.type !== "file") continue;

      if (
        file.name.endsWith(".py") ||
        file.name.endsWith(".js") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".json")
      ) {

        const raw = await fetch(file.download_url);
        const code = await raw.text();

        const lines = code.split("\n");

        lines.forEach((line, index) => {

          const n = index + 1;

          /* Python */

          if (line.includes("except:")) {
            output += `${file.name} | line ${n} | error | Broad except hides real errors\n`;
          }

          /* Secrets */

          if (
            line.includes("api_key") ||
            line.includes("API_KEY") ||
            line.includes("sk-")
          ) {
            output += `${file.name} | line ${n} | critical | Possible hardcoded secret\n`;
          }

          /* JS */

          if (line.includes("console.log(")) {
            output += `${file.name} | line ${n} | warning | Debug console.log found\n`;
          }

          /* requirements */

          if (
            file.name === "requirements.txt" &&
            line.trim() &&
            !line.includes("==")
          ) {
            output += `${file.name} | line ${n} | notice | Package version not pinned\n`;
          }

        });

      }

    }

    if (!output.trim()) {
      output = "✅ No major issues found.";
    }

    return {
      result: output
    };

  } catch (e) {

    return {
      result: "❌ Scan failed."
    };

  }

}