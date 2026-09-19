const WORKER_URL = "https://audio.tnhan.dev";

const STORAGE_KEY = "audio_library_progress";

let books = [];
let currentBook = null;
let currentEpisodes = [];
let currentEpisodeIndex = -1;


// ============================================================
// DOM
// ============================================================

const $ = (id) => document.getElementById(id);

const refreshButton = $("refreshButton");
const searchInput = $("searchInput");
const clearSearch = $("clearSearch");

const libraryView = $("libraryView");
const playerView = $("playerView");

const libraryLoading = $("libraryLoading");
const libraryError = $("libraryError");
const libraryEmpty = $("libraryEmpty");
const folderList = $("folderList");

const libraryDescription = $("libraryDescription");
const libraryErrorText = $("libraryErrorText");
const retryButton = $("retryButton");

const backButton = $("backButton");

const bookTitle = $("bookTitle");
const episodeTitle = $("episodeTitle");

const audioPlayer = $("audioPlayer");

const currentTime = $("currentTime");
const duration = $("duration");
const progressBar = $("progressBar");

const playButton = $("playButton");
const previousButton = $("previousButton");
const nextButton = $("nextButton");

const speedSelect = $("speedSelect");
const rewindButton = $("rewindButton");
const forwardButton = $("forwardButton");

const episodeCount = $("episodeCount");
const episodeLoading = $("episodeLoading");
const episodeList = $("episodeList");

const toast = $("toast");


// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    loadBooks();

    refreshButton?.addEventListener(
        "click",
        loadBooks
    );

    retryButton?.addEventListener(
        "click",
        loadBooks
    );

    backButton?.addEventListener(
        "click",
        showLibrary
    );

    searchInput?.addEventListener(
        "input",
        renderBooks
    );

    clearSearch?.addEventListener(
        "click",
        () => {
            searchInput.value = "";
            renderBooks();
            searchInput.focus();
        }
    );

    playButton?.addEventListener(
        "click",
        togglePlay
    );

    previousButton?.addEventListener(
        "click",
        previousEpisode
    );

    nextButton?.addEventListener(
        "click",
        nextEpisode
    );

    rewindButton?.addEventListener(
        "click",
        () => {
            audioPlayer.currentTime = Math.max(
                0,
                audioPlayer.currentTime - 10
            );
        }
    );

    forwardButton?.addEventListener(
        "click",
        () => {
            audioPlayer.currentTime = Math.min(
                audioPlayer.duration || Infinity,
                audioPlayer.currentTime + 30
            );
        }
    );

    speedSelect?.addEventListener(
        "change",
        () => {
            audioPlayer.playbackRate =
                Number(speedSelect.value);
        }
    );

    progressBar?.addEventListener(
        "input",
        () => {
            if (!audioPlayer.duration) return;

            audioPlayer.currentTime =
                (Number(progressBar.value) / 100) *
                audioPlayer.duration;
        }
    );


    // --------------------------------------------------------
    // AUDIO EVENTS
    // --------------------------------------------------------

    audioPlayer?.addEventListener(
        "loadedmetadata",
        () => {
            duration.textContent =
                formatTime(audioPlayer.duration);

            restoreCurrentProgress();
        }
    );

    audioPlayer?.addEventListener(
        "timeupdate",
        saveCurrentProgress
    );

    audioPlayer?.addEventListener(
        "timeupdate",
        updateProgress
    );

    audioPlayer?.addEventListener(
        "play",
        () => {
            playButton.textContent = "⏸";
        }
    );

    audioPlayer?.addEventListener(
        "pause",
        () => {
            playButton.textContent = "▶";
        }
    );

    audioPlayer?.addEventListener(
        "ended",
        () => {
            saveCurrentProgress(true);
            nextEpisode(true);
        }
    );
});


// ============================================================
// API
// ============================================================

async function apiFetch(path) {
    const response =
        await fetch(
            `${WORKER_URL}${path}`,
            {
                method: "GET",
                headers: {
                    Accept:
                        "application/json"
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}`
        );
    }

    return response.json();
}


// ============================================================
// LOAD BOOKS
// ============================================================

async function loadBooks() {
    showLibraryLoading();

    try {
        const data =
            await apiFetch("/api/books");

        if (
            !data ||
            !Array.isArray(data.books)
        ) {
            throw new Error(
                "API không trả về danh sách truyện."
            );
        }

        books = data.books;

        libraryDescription.textContent =
            `${books.length} truyện trong thư viện`;

        renderBooks();

    } catch (error) {
        console.error(
            "Load books error:",
            error
        );

        libraryLoading.classList.add(
            "hidden"
        );

        folderList.classList.add(
            "hidden"
        );

        libraryError.classList.remove(
            "hidden"
        );

        libraryErrorText.textContent =
            error.message ||
            "Không thể tải danh sách truyện.";
    }
}


// ============================================================
// RENDER BOOKS
// ============================================================

function renderBooks() {
    libraryLoading.classList.add(
        "hidden"
    );

    libraryError.classList.add(
        "hidden"
    );

    const keyword =
        searchInput?.value
            ?.trim()
            .toLowerCase() || "";

    const filtered =
        books.filter(
            (book) =>
                !keyword ||
                book.name
                    .toLowerCase()
                    .includes(keyword)
        );

    clearSearch?.classList.toggle(
        "hidden",
        !keyword
    );


    if (filtered.length === 0) {
        folderList.classList.add(
            "hidden"
        );

        libraryEmpty.classList.remove(
            "hidden"
        );

        return;
    }

    libraryEmpty.classList.add(
        "hidden"
    );

    folderList.classList.remove(
        "hidden"
    );


    folderList.innerHTML =
        filtered
            .map(
                (book) => `
                    <button
                        class="folder-card"
                        type="button"
                        data-book="${escapeHtml(book.id)}"
                    >
                        <div class="folder-icon">
                            🎧
                        </div>

                        <div class="folder-content">
                            <h3>
                                ${escapeHtml(book.name)}
                            </h3>

                            <p>
                                Mở truyện và nghe audio
                            </p>
                        </div>

                        <div class="folder-arrow">
                            →
                        </div>
                    </button>
                `
            )
            .join("");


    folderList
        .querySelectorAll(
            ".folder-card"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        openBook(
                            button.dataset.book
                        );
                    }
                );
            }
        );
}


// ============================================================
// OPEN BOOK
// ============================================================

async function openBook(bookId) {
    try {
        playerView.classList.remove(
            "hidden"
        );

        libraryView.classList.add(
            "hidden"
        );

        episodeLoading.classList.remove(
            "hidden"
        );

        episodeList.innerHTML = "";

        const data =
            await apiFetch(
                `/api/books/${encodeURIComponent(bookId)}`
            );

        if (
            !data.success ||
            !data.book
        ) {
            throw new Error(
                "Không tải được thông tin truyện."
            );
        }

        currentBook = data.book;

        currentEpisodes =
            data.book.episodes || [];

        currentEpisodeIndex = -1;

        bookTitle.textContent =
            currentBook.name;

        episodeCount.textContent =
            currentEpisodes.length;

        episodeLoading.classList.add(
            "hidden"
        );

        renderEpisodes();

        // Tìm tập đã nghe trước đó
        const saved =
            getSavedProgress(
                currentBook.id
            );

        if (
            saved &&
            saved.episodeIndex >= 0 &&
            saved.episodeIndex <
                currentEpisodes.length
        ) {
            selectEpisode(
                saved.episodeIndex,
                false
            );
        } else if (
            currentEpisodes.length > 0
        ) {
            selectEpisode(
                0,
                false
            );
        }

    } catch (error) {
        console.error(
            "Open book error:",
            error
        );

        showToast(
            "Không thể tải truyện."
        );
    }
}


// ============================================================
// RENDER EPISODES
// ============================================================

function renderEpisodes() {
    episodeList.innerHTML =
        currentEpisodes
            .map(
                (episode, index) => `
                    <button
                        class="episode-item"
                        type="button"
                        data-index="${index}"
                    >
                        <span class="episode-number">
                            ${index + 1}
                        </span>

                        <span class="episode-info">
                            <strong>
                                ${escapeHtml(
                                    episode.title ||
                                    `Tập ${index + 1}`
                                )}
                            </strong>

                            <small>
                                ${formatBytes(
                                    episode.size
                                )}
                            </small>
                        </span>

                        <span class="episode-play">
                            ▶
                        </span>
                    </button>
                `
            )
            .join("");


    episodeList
        .querySelectorAll(
            ".episode-item"
        )
        .forEach(
            (button) => {
                button.addEventListener(
                    "click",
                    () => {
                        selectEpisode(
                            Number(
                                button.dataset.index
                            ),
                            true
                        );
                    }
                );
            }
        );
}


// ============================================================
// SELECT EPISODE
// ============================================================

function selectEpisode(
    index,
    autoplay = true
) {
    if (
        index < 0 ||
        index >=
            currentEpisodes.length
    ) {
        return;
    }

    currentEpisodeIndex =
        index;

    const episode =
        currentEpisodes[index];

    episodeTitle.textContent =
        episode.title ||
        `Tập ${index + 1}`;

    audioPlayer.src =
        episode.audioUrl;

    audioPlayer.load();

    updateEpisodeActiveState();

    if (autoplay) {
        audioPlayer.play()
            .catch(() => {});
    }
}


// ============================================================
// RESTORE SAVED POSITION
// ============================================================

function restoreCurrentProgress() {
    if (
        !currentBook ||
        currentEpisodeIndex < 0
    ) {
        return;
    }

    const saved =
        getSavedProgress(
            currentBook.id
        );

    if (!saved) {
        return;
    }

    if (
        saved.episodeIndex !==
        currentEpisodeIndex
    ) {
        return;
    }

    const position =
        Number(
            saved.position || 0
        );

    if (
        position > 0 &&
        position <
            audioPlayer.duration
    ) {
        audioPlayer.currentTime =
            position;
    }

    updateProgress();
}


// ============================================================
// SAVE PROGRESS
// ============================================================

function saveCurrentProgress(
    finished = false
) {
    if (
        !currentBook ||
        currentEpisodeIndex < 0
    ) {
        return;
    }

    const position =
        audioPlayer.currentTime || 0;

    const data =
        getAllProgress();

    if (finished) {
        data[currentBook.id] = {
            episodeIndex:
                currentEpisodeIndex + 1 <
                currentEpisodes.length
                    ? currentEpisodeIndex + 1
                    : currentEpisodeIndex,

            position: 0,

            updatedAt:
                Date.now()
        };
    } else {
        data[currentBook.id] = {
            episodeIndex:
                currentEpisodeIndex,

            position,

            updatedAt:
                Date.now()
        };
    }

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );
}


// ============================================================
// GET SAVED PROGRESS
// ============================================================

function getAllProgress() {
    try {
        return JSON.parse(
            localStorage.getItem(
                STORAGE_KEY
            ) || "{}"
        );
    } catch {
        return {};
    }
}


function getSavedProgress(
    bookId
) {
    const data =
        getAllProgress();

    return data[bookId] || null;
}


// ============================================================
// UPDATE PROGRESS UI
// ============================================================

function updateProgress() {
    if (!audioPlayer.duration) {
        return;
    }

    const percent =
        (
            audioPlayer.currentTime /
            audioPlayer.duration
        ) *
        100;

    progressBar.value =
        percent;

    currentTime.textContent =
        formatTime(
            audioPlayer.currentTime
        );

    duration.textContent =
        formatTime(
            audioPlayer.duration
        );
}


// ============================================================
// PLAY / PAUSE
// ============================================================

function togglePlay() {
    if (!audioPlayer.src) {
        return;
    }

    if (audioPlayer.paused) {
        audioPlayer.play()
            .catch(() => {});
    } else {
        audioPlayer.pause();
    }
}


// ============================================================
// NEXT
// ============================================================

function nextEpisode(
    autoplay = true
) {
    if (
        currentEpisodeIndex + 1 >=
        currentEpisodes.length
    ) {
        showToast(
            "Đã hết truyện."
        );

        return;
    }

    selectEpisode(
        currentEpisodeIndex + 1,
        autoplay
    );
}


// ============================================================
// PREVIOUS
// ============================================================

function previousEpisode() {
    if (
        currentEpisodeIndex <= 0
    ) {
        audioPlayer.currentTime =
            0;

        return;
    }

    selectEpisode(
        currentEpisodeIndex - 1,
        true
    );
}


// ============================================================
// ACTIVE EPISODE
// ============================================================

function updateEpisodeActiveState() {
    episodeList
        .querySelectorAll(
            ".episode-item"
        )
        .forEach(
            (item, index) => {
                item.classList.toggle(
                    "active",
                    index ===
                        currentEpisodeIndex
                );
            }
        );
}


// ============================================================
// BACK
// ============================================================

function showLibrary() {
    audioPlayer.pause();

    saveCurrentProgress();

    playerView.classList.add(
        "hidden"
    );

    libraryView.classList.remove(
        "hidden"
    );
}


// ============================================================
// LOADING
// ============================================================

function showLibraryLoading() {
    libraryLoading.classList.remove(
        "hidden"
    );

    libraryError.classList.add(
        "hidden"
    );

    libraryEmpty.classList.add(
        "hidden"
    );

    folderList.classList.add(
        "hidden"
    );
}


// ============================================================
// TOAST
// ============================================================

function showToast(
    message
) {
    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(
        () => {
            toast.classList.remove(
                "show"
            );
        },
        2500
    );
}


// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(
    seconds
) {
    if (
        !Number.isFinite(seconds)
    ) {
        return "00:00";
    }

    seconds =
        Math.max(
            0,
            Math.floor(seconds)
        );

    const hours =
        Math.floor(
            seconds / 3600
        );

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;

    if (hours > 0) {
        return (
            String(hours).padStart(2, "0") +
            ":" +
            String(minutes).padStart(2, "0") +
            ":" +
            String(secs).padStart(2, "0")
        );
    }

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );
}


// ============================================================
// FORMAT BYTES
// ============================================================

function formatBytes(
    bytes
) {
    if (!bytes) {
        return "";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    let i = 0;
    let size = bytes;

    while (
        size >= 1024 &&
        i < units.length - 1
    ) {
        size /= 1024;
        i++;
    }

    return (
        size.toFixed(
            i === 0 ? 0 : 1
        ) +
        " " +
        units[i]
    );
}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(
    value
) {
    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
