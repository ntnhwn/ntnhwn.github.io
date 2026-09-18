"use strict";

/*
 * ============================================
 * AUDIO LIBRARY
 * GitHub repository:
 * ntnhwn/ntnhwn.github.io
 * ============================================
 */


const CONFIG = {

    owner: "ntnhwn",

    repo: "ntnhwn.github.io",

    branch: "main",

    audioRoot: "audio",

    apiBase:
        "https://api.github.com",

    rawBase:
        "https://raw.githubusercontent.com",

    supportedExtensions: [
        ".mp3",
        ".m4a",
        ".ogg",
        ".wav",
        ".aac",
        ".flac"
    ]

};


/* =========================================
   DOM
========================================= */

const $ = (selector) =>
    document.querySelector(selector);


const elements = {

    libraryView:
        $("#libraryView"),

    playerView:
        $("#playerView"),

    folderList:
        $("#folderList"),

    libraryLoading:
        $("#libraryLoading"),

    libraryError:
        $("#libraryError"),

    libraryErrorText:
        $("#libraryErrorText"),

    libraryEmpty:
        $("#libraryEmpty"),

    libraryDescription:
        $("#libraryDescription"),

    searchInput:
        $("#searchInput"),

    clearSearch:
        $("#clearSearch"),

    refreshButton:
        $("#refreshButton"),

    retryButton:
        $("#retryButton"),

    backButton:
        $("#backButton"),

    bookTitle:
        $("#bookTitle"),

    episodeTitle:
        $("#episodeTitle"),

    audioPlayer:
        $("#audioPlayer"),

    playButton:
        $("#playButton"),

    previousButton:
        $("#previousButton"),

    nextButton:
        $("#nextButton"),

    progressBar:
        $("#progressBar"),

    currentTime:
        $("#currentTime"),

    duration:
        $("#duration"),

    speedSelect:
        $("#speedSelect"),

    rewindButton:
        $("#rewindButton"),

    forwardButton:
        $("#forwardButton"),

    episodeList:
        $("#episodeList"),

    episodeLoading:
        $("#episodeLoading"),

    episodeCount:
        $("#episodeCount"),

    toast:
        $("#toast")

};


/* =========================================
   STATE
========================================= */

const state = {

    folders: [],

    filteredFolders: [],

    episodes: [],

    currentFolder: null,

    currentEpisodeIndex: -1,

    isPlayerMode: false,

    toastTimer: null

};


/* =========================================
   GITHUB API
========================================= */

function githubContentsUrl(path = "") {

    const encodedPath = path
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    return (
        `${CONFIG.apiBase}/repos/` +
        `${CONFIG.owner}/` +
        `${CONFIG.repo}/contents/` +
        `${encodedPath}` +
        `?ref=${encodeURIComponent(CONFIG.branch)}`
    );

}


async function githubFetch(path) {

    const response = await fetch(
        githubContentsUrl(path),
        {
            headers: {
                "Accept":
                    "application/vnd.github+json"
            }
        }
    );


    if (!response.ok) {

        let message =
            `GitHub API lỗi ${response.status}`;

        try {

            const error =
                await response.json();

            if (error.message) {
                message = error.message;
            }

        } catch (_) {}

        throw new Error(message);
    }


    return response.json();

}


/* =========================================
   FILE HELPERS
========================================= */

function isAudioFile(item) {

    if (!item || item.type !== "file") {
        return false;
    }


    const name =
        String(item.name || "")
            .toLowerCase();


    return CONFIG.supportedExtensions
        .some(
            extension =>
                name.endsWith(extension)
        );

}


function isFolder(item) {

    return (
        item &&
        item.type === "dir"
    );

}


function naturalSort(a, b) {

    return String(a)
        .localeCompare(
            String(b),
            undefined,
            {
                numeric: true,
                sensitivity: "base"
            }
        );

}


/* =========================================
   PATH / URL
========================================= */

function getFolderFromPath() {

    const path =
        window.location.pathname;


    const marker =
        "/audio/";


    const index =
        path.indexOf(marker);


    if (index === -1) {
        return null;
    }


    let rest =
        path.substring(
            index + marker.length
        );


    rest =
        rest.replace(
            /^\/+|\/+$/g,
            ""
        );


    if (!rest) {
        return null;
    }


    return decodeURIComponent(rest);

}


function getAudioFolderUrl(folderName) {

    return (
        `/audio/` +
        encodeURIComponent(folderName) +
        `/`
    );

}


function navigateToFolder(folderName) {

    const url =
        getAudioFolderUrl(folderName);

    window.history.pushState(
        {
            folder: folderName
        },
        "",
        url
    );


    loadPlayer(folderName);

}


function navigateToLibrary() {

    window.history.pushState(
        {},
        "",
        "/audio/"
    );


    showLibrary();

}


/* =========================================
   LOCAL STORAGE
========================================= */

function storageKey(folder, episodeName) {

    return (
        `audio-progress::` +
        `${folder}::` +
        `${episodeName}`
    );

}


function readProgress(folder, episodeName) {

    try {

        const raw =
            localStorage.getItem(
                storageKey(
                    folder,
                    episodeName
                )
            );


        if (!raw) {
            return 0;
        }


        const value =
            Number(raw);


        return Number.isFinite(value)
            ? value
            : 0;

    } catch (_) {

        return 0;

    }

}


function saveProgress() {

    if (
        !state.currentFolder ||
        state.currentEpisodeIndex < 0 ||
        !state.episodes[
            state.currentEpisodeIndex
        ]
    ) {
        return;
    }


    const episode =
        state.episodes[
            state.currentEpisodeIndex
        ];


    const current =
        elements.audioPlayer.currentTime;


    if (
        !Number.isFinite(current) ||
        current <= 0
    ) {
        return;
    }


    try {

        localStorage.setItem(
            storageKey(
                state.currentFolder,
                episode.name
            ),
            String(current)
        );

    } catch (_) {}

}


/* =========================================
   FORMATTERS
========================================= */

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {
        return "00:00";
    }


    const total =
        Math.floor(seconds);


    const hours =
        Math.floor(total / 3600);


    const minutes =
        Math.floor(
            (total % 3600) / 60
        );


    const secs =
        total % 60;


    if (hours > 0) {

        return [
            hours,
            minutes,
            secs
        ]
            .map(
                value =>
                    String(value)
                        .padStart(2, "0")
            )
            .join(":");

    }


    return [
        minutes,
        secs
    ]
        .map(
            value =>
                String(value)
                    .padStart(2, "0")
        )
        .join(":");

}


function formatEpisodeName(filename) {

    const name =
        String(filename)
            .replace(
                /\.[^/.]+$/,
                ""
            );


    return name
        .replace(
            /^(\d+)[\s._-]*/,
            "Tập $1 — "
        );

}


function extractEpisodeNumber(filename) {

    const match =
        String(filename)
            .match(/^\s*(\d+)/);


    if (!match) {
        return Number.MAX_SAFE_INTEGER;
    }


    return Number(match[1]);

}


/* =========================================
   TOAST
========================================= */

function showToast(message) {

    clearTimeout(
        state.toastTimer
    );


    elements.toast.textContent =
        message;


    elements.toast.classList.add(
        "show"
    );


    state.toastTimer =
        setTimeout(() => {

            elements.toast.classList.remove(
                "show"
            );

        }, 2200);

}


/* =========================================
   LIBRARY
========================================= */

async function loadLibrary() {

    showLibraryLoading();


    try {

        const items =
            await githubFetch(
                CONFIG.audioRoot
            );


        state.folders =
            items
                .filter(isFolder)
                .sort(
                    (a, b) =>
                        naturalSort(
                            a.name,
                            b.name
                        )
                );


        state.filteredFolders =
            [...state.folders];


        renderFolders();


        elements.libraryDescription.textContent =
            `${state.folders.length} truyện`;


    } catch (error) {

        console.error(error);

        showLibraryError(
            error.message
        );

    }

}


function renderFolders() {

    elements.libraryLoading
        .classList.add("hidden");

    elements.libraryError
        .classList.add("hidden");


    if (state.filteredFolders.length === 0) {

        elements.folderList
            .classList.add("hidden");

        elements.libraryEmpty
            .classList.remove("hidden");

        return;

    }


    elements.libraryEmpty
        .classList.add("hidden");


    elements.folderList
        .classList.remove("hidden");


    elements.folderList.innerHTML =
        state.filteredFolders
            .map(
                folder =>
                    createFolderCard(folder)
            )
            .join("");

}


function createFolderCard(folder) {

    const safeName =
        escapeHtml(folder.name);


    return `
        <article
            class="folder-card"
            data-folder="${escapeAttribute(folder.name)}"
            tabindex="0"
            role="button"
            aria-label="Mở ${safeName}"
        >

            <div class="folder-icon">
                📚
            </div>

            <div class="folder-content">

                <h2 class="folder-name">
                    ${safeName}
                </h2>

                <p class="folder-meta">
                    Mở thư viện truyện →
                </p>

            </div>

        </article>
    `;

}


function showLibraryLoading() {

    elements.libraryLoading
        .classList.remove("hidden");

    elements.libraryError
        .classList.add("hidden");

    elements.libraryEmpty
        .classList.add("hidden");

    elements.folderList
        .classList.add("hidden");

}


function showLibraryError(message) {

    elements.libraryLoading
        .classList.add("hidden");

    elements.libraryEmpty
        .classList.add("hidden");

    elements.folderList
        .classList.add("hidden");

    elements.libraryError
        .classList.remove("hidden");

    elements.libraryErrorText.textContent =
        message ||
        "Không thể tải dữ liệu từ GitHub.";

}


function filterFolders() {

    const keyword =
        elements.searchInput.value
            .trim()
            .toLocaleLowerCase();


    elements.clearSearch
        .classList.toggle(
            "hidden",
            keyword.length === 0
        );


    if (!keyword) {

        state.filteredFolders =
            [...state.folders];

    } else {

        state.filteredFolders =
            state.folders.filter(
                folder =>
                    folder.name
                        .toLocaleLowerCase()
                        .includes(keyword)
            );

    }


    renderFolders();

}


/* =========================================
   PLAYER
========================================= */

async function loadPlayer(folderName) {

    state.isPlayerMode = true;

    state.currentFolder =
        folderName;

    state.episodes = [];

    state.currentEpisodeIndex = -1;


    elements.libraryView
        .classList.add("hidden");

    elements.playerView
        .classList.remove("hidden");


    elements.bookTitle.textContent =
        folderName;


    elements.episodeTitle.textContent =
        "Đang tải danh sách tập...";


    elements.episodeList.innerHTML =
        "";


    elements.episodeLoading
        .classList.remove("hidden");


    elements.episodeCount.textContent =
        "0";


    try {

        const path =
            `${CONFIG.audioRoot}/${folderName}`;


        const items =
            await githubFetch(path);


        state.episodes =
            items
                .filter(isAudioFile)
                .sort((a, b) => {

                    const numberA =
                        extractEpisodeNumber(
                            a.name
                        );

                    const numberB =
                        extractEpisodeNumber(
                            b.name
                        );


                    if (
                        numberA !== numberB
                    ) {
                        return (
                            numberA -
                            numberB
                        );
                    }


                    return naturalSort(
                        a.name,
                        b.name
                    );

                });


        elements.episodeCount.textContent =
            String(
                state.episodes.length
            );


        elements.episodeLoading
            .classList.add("hidden");


        if (
            state.episodes.length === 0
        ) {

            elements.episodeTitle.textContent =
                "Không tìm thấy file audio.";

            elements.episodeList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        🎵
                    </div>

                    <p>
                        Folder này chưa có
                        file audio hỗ trợ.
                    </p>
                </div>
            `;

            return;

        }


        renderEpisodes();


        const savedEpisode =
            findSavedEpisode();


        const episodeToOpen =
            savedEpisode >= 0
                ? savedEpisode
                : 0;


        selectEpisode(
            episodeToOpen,
            false
        );


    } catch (error) {

        console.error(error);

        elements.episodeLoading
            .classList.add("hidden");


        elements.episodeTitle.textContent =
            "Không thể tải danh sách tập.";


        elements.episodeList.innerHTML = `
            <div class="empty-state">

                <div class="error-icon">
                    !
                </div>

                <p>
                    ${escapeHtml(
                        error.message
                    )}
                </p>

            </div>
        `;

    }

}


function renderEpisodes() {

    elements.episodeList.innerHTML =
        state.episodes
            .map(
                (episode, index) =>
                    createEpisodeItem(
                        episode,
                        index
                    )
            )
            .join("");

}


function createEpisodeItem(
    episode,
    index
) {

    const progress =
        readProgress(
            state.currentFolder,
            episode.name
        );


    const number =
        extractEpisodeNumber(
            episode.name
        );


    const displayNumber =
        Number.isSafeInteger(number) &&
        number !== Number.MAX_SAFE_INTEGER
            ? String(number)
            : String(index + 1);


    let progressText =
        "";


    if (progress > 0) {

        progressText =
            `Đã nghe ${formatTime(progress)}`;

    } else {

        progressText =
            "Chưa nghe";

    }


    return `
        <button
            type="button"
            class="episode-item"
            data-index="${index}"
        >

            <span class="episode-number">
                ${escapeHtml(
                    displayNumber
                )}
            </span>

            <span class="episode-details">

                <span class="episode-name">
                    ${escapeHtml(
                        formatEpisodeName(
                            episode.name
                        )
                    )}
                </span>

                <span class="episode-progress">
                    ${escapeHtml(
                        progressText
                    )}
                </span>

            </span>

        </button>
    `;

}


function findSavedEpisode() {

    let bestIndex = -1;

    let bestProgress = 0;


    state.episodes.forEach(
        (episode, index) => {

            const progress =
                readProgress(
                    state.currentFolder,
                    episode.name
                );


            if (
                progress > bestProgress
            ) {

                bestProgress =
                    progress;

                bestIndex =
                    index;

            }

        }
    );


    return bestIndex;

}


/* =========================================
   SELECT EPISODE
========================================= */

function selectEpisode(
    index,
    autoplay = true
) {

    if (
        index < 0 ||
        index >= state.episodes.length
    ) {
        return;
    }


    saveProgress();


    state.currentEpisodeIndex =
        index;


    const episode =
        state.episodes[index];


    elements.episodeTitle.textContent =
        formatEpisodeName(
            episode.name
        );


    const rawUrl =
        `${CONFIG.rawBase}/` +
        `${CONFIG.owner}/` +
        `${CONFIG.repo}/` +
        `${CONFIG.branch}/` +
        `${CONFIG.audioRoot}/` +
        encodeURIComponent(
            state.currentFolder
        ) +
        "/" +
        encodeURIComponent(
            episode.name
        );


    elements.audioPlayer.src =
        rawUrl;


    elements.audioPlayer.playbackRate =
        Number(
            elements.speedSelect.value
        );


    updateEpisodeActiveState();


    updateButtons();


    elements.audioPlayer.load();


    elements.audioPlayer.addEventListener(
        "loadedmetadata",
        function restorePosition() {

            elements.audioPlayer
                .removeEventListener(
                    "loadedmetadata",
                    restorePosition
                );


            const saved =
                readProgress(
                    state.currentFolder,
                    episode.name
                );


            if (
                saved > 0 &&
                Number.isFinite(
                    elements.audioPlayer.duration
                )
            ) {

                const max =
                    elements.audioPlayer.duration;


                elements.audioPlayer.currentTime =
                    Math.min(
                        saved,
                        Math.max(
                            0,
                            max - 1
                        )
                    );

            }


            updateProgress();

        }
    );


    if (autoplay) {

        const playPromise =
            elements.audioPlayer.play();


        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(() => {

                showToast(
                    "Nhấn ▶ để bắt đầu phát."
                );

            });

        }

    }

}


function updateEpisodeActiveState() {

    const items =
        elements.episodeList
            .querySelectorAll(
                ".episode-item"
            );


    items.forEach(
        (item, index) => {

            item.classList.toggle(
                "active",
                index ===
                    state.currentEpisodeIndex
            );

        }
    );


    const active =
        elements.episodeList
            .querySelector(
                ".episode-item.active"
            );


    if (active) {

        active.scrollIntoView({
            block: "nearest",
            behavior: "smooth"
        });

    }

}


/* =========================================
   AUDIO CONTROLS
========================================= */

function togglePlay() {

    if (!elements.audioPlayer.src) {

        if (state.episodes.length > 0) {

            selectEpisode(
                state.currentEpisodeIndex >= 0
                    ? state.currentEpisodeIndex
                    : 0,
                true
            );

        }

        return;
    }


    if (
        elements.audioPlayer.paused
    ) {

        elements.audioPlayer
            .play()
            .catch(() => {});

    } else {

        elements.audioPlayer.pause();

    }

}


function playPrevious() {

    if (
        state.currentEpisodeIndex <= 0
    ) {

        showToast(
            "Đây là tập đầu tiên."
        );

        return;

    }


    selectEpisode(
        state.currentEpisodeIndex - 1,
        true
    );

}


function playNext() {

    if (
        state.currentEpisodeIndex >=
        state.episodes.length - 1
    ) {

        showToast(
            "Đã đến tập cuối."
        );

        return;

    }


    selectEpisode(
        state.currentEpisodeIndex + 1,
        true
    );

}


function seekRelative(seconds) {

    if (
        !Number.isFinite(
            elements.audioPlayer.duration
        )
    ) {
        return;
    }


    elements.audioPlayer.currentTime =
        Math.max(
            0,
            Math.min(
                elements.audioPlayer.duration,
                elements.audioPlayer.currentTime +
                    seconds
            )
        );

}


function updatePlayButton() {

    if (
        elements.audioPlayer.paused
    ) {

        elements.playButton.textContent =
            "▶";

        elements.playButton.setAttribute(
            "aria-label",
            "Phát"
        );

    } else {

        elements.playButton.textContent =
            "Ⅱ";

        elements.playButton.setAttribute(
            "aria-label",
            "Tạm dừng"
        );

    }

}


function updateProgress() {

    const player =
        elements.audioPlayer;


    const current =
        Number(player.currentTime) || 0;


    const duration =
        Number(player.duration) || 0;


    elements.currentTime.textContent =
        formatTime(current);


    elements.duration.textContent =
        formatTime(duration);


    elements.progressBar.value =
        duration > 0
            ? (
                current /
                duration *
                100
            )
            : 0;

}


function updateButtons() {

    const index =
        state.currentEpisodeIndex;


    elements.previousButton.disabled =
        index <= 0;


    elements.nextButton.disabled =
        index < 0 ||
        index >=
            state.episodes.length - 1;

}


/* =========================================
   VIEWS
========================================= */

function showLibrary() {

    state.isPlayerMode = false;

    state.currentFolder = null;

    elements.playerView
        .classList.add("hidden");

    elements.libraryView
        .classList.remove("hidden");

    elements.audioPlayer.pause();

    elements.audioPlayer.removeAttribute(
        "src"
    );

    elements.audioPlayer.load();

    loadLibrary();

}


function showPlayer() {

    elements.libraryView
        .classList.add("hidden");

    elements.playerView
        .classList.remove("hidden");

}


/* =========================================
   SECURITY HELPERS
========================================= */

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

    return escapeHtml(value)
        .replaceAll("`", "&#096;");

}


/* =========================================
   ROUTER
========================================= */

function route() {

    const folder =
        getFolderFromPath();


    if (folder) {

        showPlayer();

        loadPlayer(folder);

    } else {

        showLibrary();

    }

}


/* =========================================
   EVENTS
========================================= */

elements.folderList
    .addEventListener(
        "click",
        event => {

            const card =
                event.target.closest(
                    ".folder-card"
                );


            if (!card) {
                return;
            }


            const folder =
                card.dataset.folder;


            if (folder) {

                navigateToFolder(
                    folder
                );

            }

        }
    );


elements.folderList
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key !== "Enter" &&
                event.key !== " "
            ) {
                return;
            }


            const card =
                event.target.closest(
                    ".folder-card"
                );


            if (!card) {
                return;
            }


            event.preventDefault();


            const folder =
                card.dataset.folder;


            if (folder) {

                navigateToFolder(
                    folder
                );

            }

        }
    );


elements.episodeList
    .addEventListener(
        "click",
        event => {

            const item =
                event.target.closest(
                    ".episode-item"
                );


            if (!item) {
                return;
            }


            const index =
                Number(
                    item.dataset.index
                );


            selectEpisode(
                index,
                true
            );

        }
    );


elements.playButton
    .addEventListener(
        "click",
        togglePlay
    );


elements.previousButton
    .addEventListener(
        "click",
        playPrevious
    );


elements.nextButton
    .addEventListener(
        "click",
        playNext
    );


elements.rewindButton
    .addEventListener(
        "click",
        () => seekRelative(-10)
    );


elements.forwardButton
    .addEventListener(
        "click",
        () => seekRelative(30)
    );


elements.audioPlayer
    .addEventListener(
        "play",
        updatePlayButton
    );


elements.audioPlayer
    .addEventListener(
        "pause",
        updatePlayButton
    );


elements.audioPlayer
    .addEventListener(
        "timeupdate",
        () => {

            updateProgress();

            /*
             * Lưu vị trí định kỳ.
             * Không ghi localStorage
             * ở mỗi frame.
             */
            if (
                Math.floor(
                    elements.audioPlayer.currentTime
                ) % 5 === 0
            ) {

                saveProgress();

            }

        }
    );


elements.audioPlayer
    .addEventListener(
        "loadedmetadata",
        updateProgress
    );


elements.audioPlayer
    .addEventListener(
        "ended",
        () => {

            saveProgress();

            playNext();

        }
    );


elements.progressBar
    .addEventListener(
        "input",
        () => {

            const duration =
                elements.audioPlayer.duration;


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }


            elements.audioPlayer.currentTime =
                (
                    Number(
                        elements.progressBar.value
                    ) / 100
                ) * duration;

        }
    );


elements.audioPlayer
    .addEventListener(
        "error",
        () => {

            showToast(
                "Không thể phát file audio này."
            );

        }
    );


elements.speedSelect
    .addEventListener(
        "change",
        () => {

            elements.audioPlayer.playbackRate =
                Number(
                    elements.speedSelect.value
                );


            try {

                localStorage.setItem(
                    "audio-playback-speed",
                    elements.speedSelect.value
                );

            } catch (_) {}

        }
    );


elements.searchInput
    .addEventListener(
        "input",
        filterFolders
    );


elements.clearSearch
    .addEventListener(
        "click",
        () => {

            elements.searchInput.value =
                "";

            filterFolders();

            elements.searchInput.focus();

        }
    );


elements.refreshButton
    .addEventListener(
        "click",
        () => {

            if (state.isPlayerMode) {

                if (
                    state.currentFolder
                ) {

                    loadPlayer(
                        state.currentFolder
                    );

                }

            } else {

                loadLibrary();

            }

        }
    );


elements.retryButton
    .addEventListener(
        "click",
        loadLibrary
    );


elements.backButton
    .addEventListener(
        "click",
        navigateToLibrary
    );


window.addEventListener(
    "popstate",
    route
);


window.addEventListener(
    "beforeunload",
    saveProgress
);


/* =========================================
   KEYBOARD SHORTCUTS
========================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
         * Không bắt phím khi người dùng
         * đang nhập text.
         */

        const tag =
            document.activeElement?.tagName;


        if (
            tag === "INPUT" ||
            tag === "TEXTAREA" ||
            tag === "SELECT"
        ) {
            return;
        }


        if (!state.isPlayerMode) {
            return;
        }


        switch (event.key) {

            case " ":

                event.preventDefault();

                togglePlay();

                break;


            case "ArrowLeft":

                event.preventDefault();

                seekRelative(-10);

                break;


            case "ArrowRight":

                event.preventDefault();

                seekRelative(30);

                break;


            case "ArrowUp":

                event.preventDefault();

                playPrevious();

                break;


            case "ArrowDown":

                event.preventDefault();

                playNext();

                break;

        }

    }
);


/* =========================================
   RESTORE SPEED
========================================= */

try {

    const savedSpeed =
        localStorage.getItem(
            "audio-playback-speed"
        );


    if (savedSpeed) {

        const speed =
            Number(savedSpeed);


        if (
            Number.isFinite(speed) &&
            speed > 0
        ) {

            elements.speedSelect.value =
                String(speed);

            elements.audioPlayer.playbackRate =
                speed;

        }

    }

} catch (_) {}


/* =========================================
   START
========================================= */

route();
