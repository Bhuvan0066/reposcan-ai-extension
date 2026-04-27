
if (!document.getElementById("ai-btn")) {

let currentRepo = "";
let lastRawReport = "No report yet.";


const btn = document.createElement("button");
btn.id = "ai-btn";
btn.innerHTML = `<img src="${chrome.runtime.getURL("icons/icon48.png")}" class="miniIcon">`;
document.body.appendChild(btn);



const panel = document.createElement("div");
panel.id = "ai-panel";

panel.innerHTML = `
<div id="topBar">
  <div><b>⚡ GitHub AI Reviewer</b></div>

  <div style="display:flex;gap:8px;">
    <button id="miniBtn">—</button>
    <button id="closeBtn">✕</button>
  </div>
</div>

<div id="toolbar">
  <button id="scanBtn">Scan</button>
  <button id="refreshBtn">Refresh</button>
  <button id="clearBtn">Clear</button>
  <button id="pdfBtn">PDF</button>
  <button id="shareBtn">Share</button>
</div>

<div id="result">Ready to scan repository...</div>

<div id="resizeHandle"></div>
`;

document.body.appendChild(panel);


btn.onclick = () => {
panel.classList.toggle("open");
};

document.getElementById("closeBtn").onclick = () => {
panel.classList.remove("open");
};

document.getElementById("miniBtn").onclick = () => {
const r = document.getElementById("result");
r.style.display = r.style.display === "none" ? "block" : "none";
};

document.getElementById("scanBtn").onclick = runScan;

document.getElementById("refreshBtn").onclick = () => {
location.reload();
};

document.getElementById("clearBtn").onclick = () => {
document.getElementById("result").innerHTML =
"Ready to scan repository...";
toast("Cleared");
};

document.getElementById("pdfBtn").onclick = exportPDF;

document.getElementById("shareBtn").onclick = () => {
navigator.clipboard.writeText(lastRawReport);
toast("Copied");
};
function runScan(){

currentRepo = getRepo();

document.getElementById("result").innerHTML =
"⏳ Running scan...";

chrome.runtime.sendMessage({
type:"scan_repo",
repo:currentRepo
}, function(res){

if(!res || !res.result){
document.getElementById("result").innerHTML =
"❌ Scan failed.";
return;
}

lastRawReport = res.result;
renderIssues(res.result);

});

}

function getRepo(){
return location.pathname.split("/").slice(1,3).join("/");
}


function renderIssues(text){

if(text.startsWith("✅") || text.startsWith("❌")){
document.getElementById("result").innerText = text;
return;
}

const rows = text.split("\n").filter(x => x.includes("|"));

let html = `
<table class="issueTable">
<tr>
<th>File</th>
<th>Line</th>
<th>Level</th>
<th>Issue</th>
<th></th>
</tr>
`;

rows.forEach(row => {

const p = row.split("|").map(x => x.trim());

if(p.length >= 4){

const file = p[0];
const line = p[1].replace("line ","");
const level = p[2];
const msg = p[3];

let color = "#22c55e";
if(level==="notice") color="#3b82f6";
if(level==="warning") color="#f59e0b";
if(level==="error") color="#ef4444";
if(level==="critical") color="#dc2626";

html += `
<tr>
<td>${file}</td>
<td>${line}</td>
<td style="color:${color};font-weight:700;">${level}</td>
<td>${msg}</td>
<td><button class="menuBtn" data-msg="${msg}">⋮</button></td>
</tr>
`;

}

});

html += `</table>`;

document.getElementById("result").innerHTML = html;

document.querySelectorAll(".menuBtn").forEach(button => {

button.onclick = function(e){

e.stopPropagation();

showMenu(
e.pageX,
e.pageY,
button.dataset.msg,
button.closest("tr")
);

};

});

}


function showMenu(x,y,msg,row){

removeMenu();

const menu = document.createElement("div");
menu.id = "fixMenu";

menu.style.position = "fixed";
menu.style.left = x + "px";
menu.style.top = y + "px";
menu.style.zIndex = "99999999";
menu.style.minWidth = "180px";
menu.style.background = "rgba(15,23,42,.98)";
menu.style.border = "1px solid rgba(255,255,255,.1)";
menu.style.borderRadius = "14px";
menu.style.padding = "8px";
menu.style.display = "flex";
menu.style.flexDirection = "column";
menu.style.gap = "6px";

menu.innerHTML = `
<button class="menuAction" data-action="copy">Copy Issue</button>
<button class="menuAction" data-action="hide">Hide Row</button>
<button class="menuAction" data-action="fix">Generate Fix</button>
`;

document.body.appendChild(menu);

menu.querySelectorAll(".menuAction").forEach(btn => {

btn.onclick = function(ev){

ev.stopPropagation();

const action = this.dataset.action;

/* COPY */
if(action === "copy"){
navigator.clipboard.writeText(msg);
toast("Copied");
}

/* HIDE */
if(action === "hide"){
row.remove();
toast("Hidden");
}

/* REAL FIX */
if(action === "fix"){

toast("Generating AI Fix...");

chrome.runtime.sendMessage({
type:"fix_issue",
issue:msg
}, function(res){

showBigPopup(
"Suggested Fix",
(res && res.result) ? res.result : "Fix failed.",
"fix.txt"
);

});

}

removeMenu();

};

});

setTimeout(() => {
document.addEventListener("click", removeMenu, {once:true});
},100);

}

function removeMenu(){
const old = document.getElementById("fixMenu");
if(old) old.remove();
}


function showBigPopup(title,text,file){

const old = document.getElementById("bigPopup");
if(old) old.remove();

const p = document.createElement("div");
p.id = "bigPopup";

p.innerHTML = `
<div class="popupHead">
<b>${title}</b>
<span id="closeBig">✕</span>
</div>

<pre id="popupText">${text}</pre>

<div class="popupBtns">
<button id="copyBig">Copy</button>
<button id="downBig">Download</button>
</div>
`;

document.body.appendChild(p);

document.getElementById("closeBig").onclick = () => {
p.remove();
};

document.getElementById("copyBig").onclick = () => {
navigator.clipboard.writeText(text);
toast("Copied");
};

document.getElementById("downBig").onclick = () => {

const blob = new Blob([text], {type:"text/plain"});
const a = document.createElement("a");

a.href = URL.createObjectURL(blob);
a.download = file;
a.click();

};

}


function exportPDF(){

const w = window.open("", "_blank");

w.document.write(`
<html>
<body style="font-family:Arial;padding:30px;">
<h1>GitHub Audit Report</h1>
<pre>${lastRawReport}</pre>
<script>window.onload=function(){window.print()}</script>
</body>
</html>
`);

w.document.close();

}


function toast(msg){

const t = document.createElement("div");
t.className = "toastBox";
t.innerText = msg;

document.body.appendChild(t);

setTimeout(() => {
t.remove();
},1500);

}



let drag = false;
let ox = 0;
let oy = 0;

document.addEventListener("mousedown", function(e){

if(e.target.closest("#topBar")){

drag = true;

const rect = panel.getBoundingClientRect();

ox = e.clientX - rect.left;
oy = e.clientY - rect.top;

}

});

document.addEventListener("mousemove", function(e){

if(drag){

panel.style.left = (e.clientX - ox) + "px";
panel.style.top = (e.clientY - oy) + "px";
panel.style.right = "auto";
panel.style.bottom = "auto";

}

});

document.addEventListener("mouseup", function(){
drag = false;
});

}