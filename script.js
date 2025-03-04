let referenceVideos = null;  // reference.csv 데이터를 한 번만 로드하도록 설정
let generatedVideos = [];    // videos.csv에서 불러온 데이터 저장
let currentIndex = 0;
let googleScriptURL = localStorage.getItem("googleScriptURL") || "";
let referenceImages = {};

let isInitialized = false; 
let userResponses = {};

// 특정 키워드 목록 (EC, DE, AE, BE, EB 등)
const keywords = ["AE", "BE", "CE", "DE", "EA", "EB", "EC", "ED"];

// CSV 파일을 읽어 JSON으로 변환하는 함수
async function loadCSV(file) {
    const response = await fetch(file);
    const data = await response.text();

    const rows = data.split("\n").map(row => row.trim()).filter(row => row);
    const headers = rows[0].split(",").map(header => header.trim());

    return rows.slice(1).map(row => {
        const values = row.split(",").map(value => value.trim()); 
        // console.log(`values: ${values}`);
        return Object.fromEntries(headers.map((header, i) => [header, values[i] || ""]));
    });
}

async function initializeData() {
    if (isInitialized) {
        console.log("[INFO] initializeData() called");
        return; 
    }

    console.log("[INFO] loading data ...");
    isInitialized = true;
    
    userResponses = {};

    if (!referenceVideos) {
        console.log("[INFO] loading reference.csv ...");
        const refData = await loadCSV("reference.csv"); 
        referenceVideos = {};
        refData.forEach(video => {
            if (video.title && video["Embedded link"]) {
                referenceVideos[video.title.trim()] = video["Embedded link"].trim();
            }
        });
    }

    console.log("[INFO] loading ref-image.csv ...");
    const refImageData = await loadCSV("ref-image.csv");
    let referenceImages = {};
    refImageData.forEach(image => {
        if (image.title && image["root link"]) {
            referenceImages[image.title.trim()] = image["root link"].trim();
        }
    });

    const genData = await loadCSV("videos.csv");
    generatedVideos = [];

    genData.forEach(video => {
        if (!video.title || !video["Embedded link"]) {
            return;
        }

        const title = video.title.trim();
        const mode = video.Mode.trim();
        const task = video.task.trim();
        const tgt = video.tgt.trim();
        const videoKey = `${mode}-${title}-${task}-${tgt}`;

        const embeddedLink = video["Embedded link"].trim();

        let referenceTitle = findReferenceTitle(title);
        let referenceLink = referenceVideos[referenceTitle] || "";
        // let referenceImage = referenceImages[tgt] || ""; 
        let referenceImage = (`${task}` === "reenact") ? referenceImages[tgt] : referenceImages[title];
        console.log(`[INFO] ${task} tgt: ${tgt}: title ${title} -> ${referenceImages[tgt]} | `);
        
        if (!userResponses[videoKey]) {
            userResponses[videoKey] = { motion: "none", sync: "none", appearance: "none" };
        }

        generatedVideos.push({ title, mode, task, tgt, videoKey, generatedLink: embeddedLink, referenceTitle, referenceLink, referenceImage });
    });

    shuffleArray(generatedVideos);

    if (generatedVideos.length > 0) {
        currentIndex = 0;
        updateVideo();
    } else {
        console.error("[ERROR] no video loaded!");
    }

    localStorage.setItem("generatedVideos", JSON.stringify(generatedVideos));
    console.log("[INFO] loaded ! total", generatedVideos.length, "videos");
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; 
    }
}

function updateChoice(questionIndex, choice) {
    if (generatedVideos.length === 0) return;
    
    const videoData = generatedVideos[currentIndex];
    const videoKey = videoData.videoKey; 

    if (questionIndex === 1) {
        userResponses[videoKey].motion = choice;
        document.getElementById("motionA").checked = (choice === 'A');
        document.getElementById("motionB").checked = (choice === 'B');
    } else if (questionIndex === 2) {
        userResponses[videoKey].sync = choice;
        document.getElementById("syncA").checked = (choice === 'A');
        document.getElementById("syncB").checked = (choice === 'B');
    } else if (questionIndex === 3) {
        userResponses[videoKey].appearance = choice;
        document.getElementById("appearanceA").checked = (choice === 'A');
        document.getElementById("appearanceB").checked = (choice === 'B');
    }

    console.log(`[INFO] ${videoKey} - Q${questionIndex}: ${choice}`);
}




function saveGoogleScriptURL() {
    const inputURL = document.getElementById("googleScriptURL").value.trim();
    
    if (!inputURL.startsWith("https://script.google.com/macros/s/")) {
        alert("🚨 Enter appropreate Google Apps Script URL!");
        return;
    }

    googleScriptURL = inputURL; 
    localStorage.setItem("googleScriptURL", googleScriptURL);
    alert("Google Script URL!");
}

// title에서 키워드 다음의 단어 찾기
function findReferenceTitle(title) {
    let trimmedTitle = title.trim();

    // referenceVideos 객체에서 해당 title이 있는지 확인
    if (trimmedTitle in referenceVideos) {
        return trimmedTitle;
    }
    return "";
}


// 동영상 변경
function changeVideo(direction) {
    if (generatedVideos.length === 0) return;

    //checking checks!
    if (!isAllChecked()) {
        alert("🚨 You need to answer to all questions!!");
        return;
    }

    currentIndex += direction;

    if (currentIndex < 0) currentIndex = 0;
    if (currentIndex >= generatedVideos.length) {
        currentIndex = generatedVideos.length - 1;
    }
    
    updateVideo();
}

function resetCheckboxes() {
    document.getElementById("motionA").checked = false;
    document.getElementById("motionB").checked = false;
    document.getElementById("syncA").checked = false;
    document.getElementById("syncB").checked = false;
    document.getElementById("appearanceA").checked = false;
    document.getElementById("appearanceB").checked = false;
}


function restartVideos() {
    if (generatedVideos.length === 0) return;

    currentIndex = 0;
    updateVideo();
}


function updateVideo() {
    if (generatedVideos.length === 0) {
        console.error("[ERROR] no video more to move on!");
        return;
    }

    // get video
    const videoData = generatedVideos[currentIndex];
    const videoKey = videoData.videoKey;
    const titleElement = document.getElementById("videoTitle");
    const generatedVideoFrame = document.getElementById("generatedVideo");


    // 생성된 비디오 정보 표시
    // titleElement.textContent = videoData.title;
    let num = `[${currentIndex+1}:${generatedVideos.length}]`;

    titleElement.textContent = (videoData.task === "reenact") ? `${num} Reenact task` : `${num} Dubbing task`;
    generatedVideoFrame.src = videoData.generatedLink;
    generatedVideoFrame.allow = "autoplay; controls; loop; playsinline";

    const referenceVideoFrame = document.getElementById("referenceVideo");
    // const referenceSection = document.getElementById("referenceSection");

    referenceVideoFrame.src = videoData.referenceLink;
    referenceVideoFrame.allow = "autoplay; controls; loop; playsinline";

    const referenceImage = document.getElementById("referenceImage");
    // if (videoData.task === "reenact" && videoData.referenceImage) {
    if (videoData.referenceImage) {
        referenceImage.src = videoData.referenceImage;
        referenceImage.style.display = "block";
    } else {
        referenceImage.style.display = "none";
    }
    
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const homeBtn = document.getElementById("homeBtn");

    if (prevBtn) prevBtn.style.display = currentIndex === 0 ? "none" : "inline-block";
    if (nextBtn) nextBtn.style.display = currentIndex === generatedVideos.length - 1 ? "none" : "inline-block";
    if (homeBtn) homeBtn.style.display = currentIndex === generatedVideos.length - 1 ? "inline-block" : "none";

    resetCheckboxes();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function isAllChecked() {
    return (
        (document.getElementById("motionA").checked || document.getElementById("motionB").checked) &&
        (document.getElementById("syncA").checked || document.getElementById("syncB").checked) &&
        (document.getElementById("appearanceA").checked || document.getElementById("appearanceB").checked)
    );
}



function saveResponsesToGoogleSheets() {
    //// 왜인지 모르겠는데 API 안됨 ... 무조건 복사.... 
    // if (!googleScriptURL) {
    //     alert("Enter proper Google Apps Script URL!");
    //     return;
    // }
    // fetch(googleScriptURL, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify(userResponses)
    // })
    // .then(response => {
    //     alert("설문 응답이 정상적으로로 제출되었습니다!");
    // })
    // .catch(error => {
    //     console.error("앗 제출 ❌ 오류;;;", error);
    //     showFailureMessage();
    // });

    // 일단 무조건 실패!
    showFailureMessage();
}
function showFailureMessage() {
    const failedData = JSON.stringify(userResponses, null, 2);

    // alert("🚨 오우 쉩! Google Sheets 전송에 쉴패했습니다!\n\n" +
    //       "⚠️ 직접 복사하여 메시지로 보내주세요.\n\n" +
    //       "📋 확인 버튼을 누르면 데이터가 json 형식으로 클립보드에 복사됩니다.");

    // 🔹 실패한 데이터를 클립보드에 자동 복사
    copyToClipboard(failedData);
}

function copyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("📋 Data is copied to your clipboard!!\n\nNow you can cpoy and paste the result.");
}



function checkCompletionAndShowResults() {
    let allCompleted = true;
    let resultsHTML = `
        <h3>Survey Results</h3>
        <table border="1">
            <tr>
                <th>Video</th>
                <th>Motion Similarity</th>
                <th>Lip Sync</th>
                <th>Appearance Similarity</th>
            </tr>
    `;

    for (const videoKey in userResponses) {
        const response = userResponses[videoKey];
        console.log(`response: ${response}`);
        // 응답이 없을 경우 기본값 "Not Answered" 표시
        const motion = response.motion ? response.motion : "Not Answered";
        const sync = response.sync ? response.sync : "Not Answered";
        const appearance = response.appearance ? response.appearance : "Not Answered";

        resultsHTML += `
            <tr>
                <td>${videoKey}</td>
                <td>${motion}</td>
                <td>${sync}</td>
                <td>${appearance}</td>
            </tr>
        `;
    }

    resultsHTML += `</table>`;

    document.getElementById("resultsContainer").innerHTML = resultsHTML;
    document.getElementById("resultsContainer").style.display = "block";
    document.getElementById("submitSurveyBtn").style.display = "block";
    console.log("[INFO] show result.");
}



document.addEventListener("DOMContentLoaded", () => {
    console.log("[INFO] DOMContentLoaded ! - call initializeData() ");
    initializeData();
});