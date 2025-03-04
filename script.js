let referenceVideos = null;  // reference.csv 데이터를 한 번만 로드하도록 설정
let generatedVideos = [];    // videos.csv에서 불러온 데이터 저장
let currentIndex = 0;
let googleScriptURL = localStorage.getItem("googleScriptURL") || ""; // 🔥 `let`으로 변경
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
        console.log("⚠️ [INFO] initializeData()가 이미 실행되었음. 재실행 방지.");
        return; // 🔥 이미 실행되었다면 다시 실행되지 않도록 차단
    }

    console.log("📌 [INFO] 데이터 로딩 시작...");
    isInitialized = true;
    
    userResponses = {};

    if (!referenceVideos) {
        console.log("📌 [INFO] reference.csv 데이터 로딩...");
        const refData = await loadCSV("reference.csv"); 
        referenceVideos = {};
        refData.forEach(video => {
            if (video.title && video["Embedded link"]) {
                referenceVideos[video.title.trim()] = video["Embedded link"].trim();
            }
        });
        // console.log("[INFO] referenceVideos 로드 완료:", referenceVideos);
    }

    // ref-image.csv 로드 & Google Drive 이미지 URL 변환
    console.log("📌 [INFO] ref-image.csv 데이터 로딩...");
    const refImageData = await loadCSV("ref-image.csv");
    let referenceImages = {};
    refImageData.forEach(image => {
        if (image.title && image["root link"]) {
            referenceImages[image.title.trim()] = image["root link"].trim();
        }
    });
    // console.log("[INFO] referenceImages 로드 완료:", referenceImages);

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
        const videoKey = `${mode}-${title}-${task}-${tgt}`; // 🔥 고유 Key 생성

        const embeddedLink = video["Embedded link"].trim();

        let referenceTitle = findReferenceTitle(title);
        let referenceLink = referenceVideos[referenceTitle] || "";
        // let referenceImage = referenceImages[tgt] || ""; 
        let referenceImage = (`${task}` === "reenact") ? referenceImages[tgt] : referenceImages[title];
        console.log(`📌 [INFO] ${task} tgt: ${tgt}: title ${title} -> ${referenceImages[tgt]} | `);
        
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
        console.error("[ERROR] 로드된 비디오가 없습니다!");
    }

    localStorage.setItem("generatedVideos", JSON.stringify(generatedVideos));
    console.log("[INFO] 총", generatedVideos.length, "개의 비디오 데이터가 로드됨");
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
    const videoKey = videoData.videoKey; // 🔥 `${Mode}-${title}` 사용

    // if (!userResponses[videoKey]) {
    //     userResponses[videoKey] = { motion: "none", sync: "none", appearance: "none" };
    // }

    // 🔹 같은 질문에서 하나만 선택할 수 있도록 처리
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

    console.log(`✅ [INFO] ${videoKey} - Q${questionIndex}: ${choice}`);
}




function saveGoogleScriptURL() {
    const inputURL = document.getElementById("googleScriptURL").value.trim();
    
    if (!inputURL.startsWith("https://script.google.com/macros/s/")) {
        alert("🚨 올바른 Google Apps Script URL을 입력하세요!");
        return;
    }

    googleScriptURL = inputURL;  // ✅ 이제 정상적으로 값 변경 가능
    localStorage.setItem("googleScriptURL", googleScriptURL);
    alert("✅ Google Script URL이 저장되었습니다!");
}

// title에서 키워드 다음의 단어 찾기
function findReferenceTitle(title) {
    let trimmedTitle = title.trim(); // 앞뒤 공백 제거

    // 🔹 referenceVideos 객체에서 해당 title이 있는지 확인
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
        alert("🚨 모든 질문에 응답하셔야 다음 페이지로 이동할 수 있습니다!");
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

// 처음으로 버튼 클릭 시 첫 영상으로 이동
function restartVideos() {
    if (generatedVideos.length === 0) return;

    currentIndex = 0;
    updateVideo();
}


function updateVideo() {
    if (generatedVideos.length === 0) {
        console.error("❌ [ERROR] 업데이트할 비디오가 없습니다!");
        return;
    }

    // get video
    const videoData = generatedVideos[currentIndex];
    const videoKey = videoData.videoKey; // `${Mode}-${title}` 사용
    const titleElement = document.getElementById("videoTitle");
    const generatedVideoFrame = document.getElementById("generatedVideo");


    // 생성된 비디오 정보 표시
    // titleElement.textContent = videoData.title;
    let num = `[${currentIndex+1}:${generatedVideos.length}]`;

    titleElement.textContent = (videoData.task === "reenact") ? `${num} Reenact task` : `${num} Dubbing task`;
    generatedVideoFrame.src = videoData.generatedLink;
    generatedVideoFrame.allow = "autoplay; controls; loop; playsinline"; // allow 속성 적용

    const referenceVideoFrame = document.getElementById("referenceVideo");
    // const referenceSection = document.getElementById("referenceSection");

    referenceVideoFrame.src = videoData.referenceLink;
    referenceVideoFrame.allow = "autoplay; controls; loop; playsinline"; // allow 속성 적용

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
    // 🔹 페이지 전환 시 스크롤을 맨 위로 이동
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function isAllChecked() {
    return (
        (document.getElementById("motionA").checked || document.getElementById("motionB").checked) &&
        (document.getElementById("syncA").checked || document.getElementById("syncB").checked) &&
        (document.getElementById("appearanceA").checked || document.getElementById("appearanceB").checked)
    );
}



// function saveResponsesToGoogleSheets() {
//     if (!googleScriptURL) {
//         alert("🚨 Google Apps Script URL을 입력하세요!");
//         return;
//     }

//     fetch(googleScriptURL, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(userResponses)
//     })
//     .then(response => response.text())
//     .then(data => {
//         console.log("✅ 응답 저장 완료:", data);
//         alert("설문 응답이 저장되었습니다!");
//     })
//     .catch(error => console.error("❌ 오류 발생:", error));
// }
function saveResponsesToGoogleSheets() {
    //// 왜인지 모르겠는데 API 안됨 ... 무조건 복사.... 
    // if (!googleScriptURL) {
    //     alert("🚨 Google Apps Script URL을 입력하세요!");
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
    const failedData = JSON.stringify(userResponses, null, 2); // 🔥 JSON 데이터를 보기 쉽게 변환

    alert("🚨 오우 쉩! Google Sheets 전송에 쉴패했습니다!\n\n" +
          "⚠️ 직접 복사하여 메시지로 보내주세요.\n\n" +
          "📋 확인 버튼을 누르면 데이터가 json 형식으로 클립보드에 복사됩니다.");

    // 🔹 실패한 데이터를 클립보드에 자동 복사
    copyToClipboard(failedData);
    
    console.log("📌 [INFO] 실패한 응답 데이터:", failedData);
}
function copyToClipboard(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    alert("📋 데이터가 클립보드에 복사되었습니다!\n\n이제 직접 붙여넣어서 보내주세요.");
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
        // 🔹 응답이 없을 경우 기본값 "Not Answered" 표시
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
    document.getElementById("submitSurveyBtn").style.display = "block"; // 🔥 Google Sheets 전송 버튼 표시
    console.log("[INFO] 모든 결과 표시.");
}



document.addEventListener("DOMContentLoaded", () => {
    console.log("📌 [INFO] DOMContentLoaded 이벤트 발생 - initializeData 실행");
    initializeData();
});