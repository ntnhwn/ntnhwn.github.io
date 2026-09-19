const WORKER_URL = "https://audio.tnhan.dev";

const STORAGE_KEY = "audio_library_progress_v2";

let books = [];
let currentBook = null;
let currentEpisodes = [];
let currentEpisodeIndex = -1;
let lastSavedTime = 0;

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

    refreshButton?.addEventListener("click", loadBooks);
    retryButton?.addEventListener("click", loadBooks);

    backButton?.addEventListener("click", showLibrary);

    searchInput?.addEventListener("input", renderBooks);

    clearSearch?.addEventListener("click", () => {
        searchInput.value = "";
        renderBooks();
        searchInput.focus();
    });

    playButton?.addEventListener("click", togglePlay);
    previousButton?.addEventListener("click", previousEpisode);
    nextButton?.addEventListener("click", () => nextEpisode(true));

    rewindButton?.addEventListener("click", () => {
        if (!Number.isFinite(audioPlayer.currentTime)) {
            return;
        }

        audioPlayer.currentTime = Math.max(
            0,
            audioPlayer.currentTime - 10
        );

        saveCurrentProgress();
    });

    forwardButton?.addEventListener("click", () => {
        if (!Number.isFinite(audioPlayer.duration)) {
            return;
        }

        audioPlayer.currentTime = Math.min(
            audioPlayer.duration,
            audioPlayer.currentTime + 30
        );

        saveCurrentProgress();
    });

    speedSelect?.addEventListener("change", () => {
        audioPlayer.playbackRate = Number(
            speedSelect.value
        );
    });

    progressBar?.addEventListener("input", () => {
        if (!Number.isFinite(audioPlayer.duration)) {
            return;
        }

        audioPlayer.currentTime =
            (Number(progressBar.value) / 100) *
            audioPlayer.duration;
    });

    // Khi audio load xong metadata
    audioPlayer?.addEventListener(
        "loadedmetadata",
        () => {
            duration.textContent =
                formatTime(audioPlayer.duration);

            restoreCurrentProgress();

            updateProgress();
        }
    );

    // Cập nhật thanh progress
    audioPlayer?.addEventListener(
        "timeupdate",
        updateProgress
    );

    // Lưu khoảng mỗi 2 giây
    audioPlayer?.addEventListener(
        "timeupdate",
        () => {
            const now =
                audioPlayer.currentTime || 0;

            if (
                Math.abs(
                    now - lastSavedTime
                ) >= 2
            ) {
                saveCurrentProgress();
            }
        }
    );

    // Play
    audioPlayer?.addEventListener(
        "play",
        () => {
            playButton.textContent = "⏸";
        }
    );

    // Pause
    audioPlayer?.addEventListener(
        "pause",
        () => {
            playButton.textContent = "▶";

            saveCurrentProgress();
        }
    );

    // Hết tập
    audioPlayer?.addEventListener(
        "ended",
        () => {
            /*
             * Không lưu sang tập kế tiếp.
             * Chỉ chuyển tập.
             */
            if (
                currentEpisodeIndex + 1 <
                currentEpisodes.length
            ) {
                nextEpisode(true);
            } else {
                saveCurrentProgress();
            }
        }
    );

    // Reload / đóng tab
    window.addEventListener(
        "beforeunload",
        () => {
            saveCurrentProgress();
        }
    );

    window.addEventListener(
        "pagehide",
        () => {
            saveCurrentProgress();
        }
    );

    // Chuyển tab / background
    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState ===
                "hidden"
            ) {
                saveCurrentProgress();
            }
        }
    );
});

// ============================================================
// API
// ============================================================

async function apiFetch(path) {
    const response = await fetch(
        `${WORKER_URL}${path}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json"
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

        if (libraryDescription) {
            libraryDescription.textContent =
                `${books.length} truyện trong thư viện`;
        }

        renderBooks();

    } catch (error) {
        console.error(
            "Load books error:",
            error
        );

        libraryLoading?.classList.add(
            "hidden"
        );

        folderList?.classList.add(
            "hidden"
        );

        libraryEmpty?.classList.add(
            "hidden"
        );

        libraryError?.classList.remove(
            "hidden"
        );

        if (libraryErrorText) {
            libraryErrorText.textContent =
                error.message ||
                "Không thể tải danh sách truyện.";
        }
    }
}

// ============================================================
// RENDER BOOKS
// ============================================================

function renderBooks() {
    libraryLoading?.classList.add(
        "hidden"
    );

    libraryError?.classList.add(
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
                String(
                    book.name || ""
                )
                    .toLowerCase()
                    .includes(keyword)
        );

    clearSearch?.classList.toggle(
        "hidden",
        !keyword
    );

    if (filtered.length === 0) {
        folderList?.classList.add(
            "hidden"
        );

        libraryEmpty?.classList.remove(
            "hidden"
        );

        return;
    }

    libraryEmpty?.classList.add(
        "hidden"
    );

    folderList?.classList.remove(
        "hidden"
    );

    folderList.innerHTML =
        filtered
            .map(
                (book) => `
                    <button
                        class="folder-card"
                        type="button"
                        data-book="${escapeHtml(
                            book.id
                        )}"
                    >
                        <div class="folder-icon">
                            🎧
                        </div>

                        <div class="folder-content">
                            <h3>
                                ${escapeHtml(
                                    book.name
                                )}
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
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    openBook(
                        button.dataset.book
                    );
                }
            );
        });
}

// ============================================================
// OPEN BOOK
// ============================================================

async function openBook(bookId) {
    try {
        playerView?.classList.remove(
            "hidden"
        );

        libraryView?.classList.add(
            "hidden"
        );

        episodeLoading?.classList.remove(
            "hidden"
        );

        episodeList.innerHTML = "";

        const data =
            await apiFetch(
                `/api/books/${encodeURIComponent(
                    bookId
                )}`
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
            Array.isArray(
                data.book.episodes
            )
                ? data.book.episodes
                : [];

        currentEpisodeIndex = -1;
        lastSavedTime = 0;

        bookTitle.textContent =
            currentBook.name;

        episodeCount.textContent =
            currentEpisodes.length;

        episodeLoading?.classList.add(
            "hidden"
        );

        renderEpisodes();

        if (
            currentEpisodes.length === 0
        ) {
            showToast(
                "Truyện chưa có tập nào."
            );

            return;
        }

        const saved =
            getSavedProgress(
                currentBook.id
            );

        if (
            saved &&
            Number.isInteger(
                Number(
                    saved.episodeIndex
                )
            ) &&
            Number(
                saved.episodeIndex
            ) >= 0 &&
            Number(
                saved.episodeIndex
            ) <
                currentEpisodes.length
        ) {
            selectEpisode(
                Number(
                    saved.episodeIndex
                ),
                false
            );
        } else {
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
            error.message ||
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
                                    `Tập ${
                                        index + 1
                                    }`
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
        .forEach((button) => {
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
        });

    updateEpisodeActiveState();
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

    /*
     * Lưu vị trí tập cũ
     * trước khi chuyển sang tập mới.
     */
    if (
        currentEpisodeIndex >= 0 &&
        currentEpisodeIndex !== index
    ) {
        saveCurrentProgress();
    }

    currentEpisodeIndex = index;

    lastSavedTime = 0;

    const episode =
        currentEpisodes[index];

    episodeTitle.textContent =
        episode.title ||
        `Tập ${index + 1}`;

    progressBar.value = 0;

    currentTime.textContent =
        "00:00";

    duration.textContent =
        "00:00";

    audioPlayer.src =
        episode.audioUrl;

    audioPlayer.playbackRate =
        Number(
            speedSelect?.value || 1
        );

    audioPlayer.load();

    updateEpisodeActiveState();

    if (autoplay) {
        audioPlayer
            .play()
            .catch(() => {});
    }
}

// ============================================================
// PROGRESS STORAGE
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

    return (
        data[bookId] || null
    );
}

function saveCurrentProgress() {
    if (
        !currentBook ||
        currentEpisodeIndex < 0 ||
        !currentEpisodes[
            currentEpisodeIndex
        ]
    ) {
        return;
    }

    const position =
        Number(
            audioPlayer.currentTime ||
                0
        );

    if (
        !Number.isFinite(
            position
        )
    ) {
        return;
    }

    const data =
        getAllProgress();

    data[currentBook.id] = {
        episodeIndex:
            currentEpisodeIndex,

        position: position,

        duration:
            Number.isFinite(
                audioPlayer.duration
            )
                ? audioPlayer.duration
                : 0,

        updatedAt:
            Date.now()
    };

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

        lastSavedTime =
            position;

        console.log(
            "[Progress saved]",
            currentBook.id,
            "Tập:",
            currentEpisodeIndex +
                1,
            "Thời gian:",
            formatTime(
                position
            )
        );

    } catch (error) {
        console.error(
            "Cannot save progress:",
            error
        );
    }
}

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
        console.log(
            "[Progress] Không có dữ liệu lưu."
        );

        return;
    }

    console.log(
        "[Progress restore]",
        saved
    );

    if (
        Number(
            saved.episodeIndex
        ) !==
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
        Number.isFinite(
            audioPlayer.duration
        ) &&
        position <
            audioPlayer.duration - 2
    ) {
        audioPlayer.currentTime =
            position;

        lastSavedTime =
            position;

        console.log(
            "[Progress restored]",
            currentBook.id,
            "Tập:",
            currentEpisodeIndex +
                1,
            "Thời gian:",
            formatTime(
                position
            )
        );
    }
}

// ============================================================
// PROGRESS UI
// ============================================================

function updateProgress() {
    if (
        !Number.isFinite(
            audioPlayer.duration
        ) ||
        audioPlayer.duration <= 0
    ) {
        return;
    }

    const percent =
        (
            audioPlayer.currentTime /
            audioPlayer.duration
        ) *
        100;

    progressBar.value =
        Math.min(
            100,
            Math.max(
                0,
                percent
            )
        );

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

    if (
        audioPlayer.paused
    ) {
        audioPlayer
            .play()
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

        saveCurrentProgress();

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

        saveCurrentProgress();

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
            (
                item,
                index
            ) => {
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
    saveCurrentProgress();

    audioPlayer.pause();

    playerView?.classList.add(
        "hidden"
    );

    libraryView?.classList.remove(
        "hidden"
    );
}

// ============================================================
// LOADING
// ============================================================

function showLibraryLoading() {
    libraryLoading?.classList.remove(
        "hidden"
    );

    libraryError?.classList.add(
        "hidden"
    );

    libraryEmpty?.classList.add(
        "hidden"
    );

    folderList?.classList.add(
        "hidden"
    );
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
    if (!toast) {
        return;
    }

    toast.textContent =
        message;

    toast.classList.add(
        "show"
    );

    setTimeout(() => {
        toast.classList.remove(
            "show"
        );
    }, 2500);
}

// ============================================================
// FORMAT TIME
// ============================================================

function formatTime(seconds) {
    if (
        !Number.isFinite(
            seconds
        )
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
            (seconds % 3600) /
                60
        );

    const secs =
        seconds % 60;

    if (hours > 0) {
        return (
            String(
                hours
            ).padStart(
                2,
                "0"
            ) +
            ":" +
            String(
                minutes
            ).padStart(
                2,
                "0"
            ) +
            ":" +
            String(
                secs
            ).padStart(
                2,
                "0"
            )
        );
    }

    return (
        String(
            minutes
        ).padStart(
            2,
            "0"
        ) +
        ":" +
        String(
            secs
        ).padStart(
            2,
            "0"
        )
    );
}

// ============================================================
// FORMAT BYTES
// ============================================================

function formatBytes(bytes) {
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

    let size =
        Number(bytes);

    while (
        size >= 1024 &&
        i <
            units.length - 1
    ) {
        size /= 1024;
        i++;
    }

    return (
        size.toFixed(
            i === 0
                ? 0
                : 1
        ) +
        " " +
        units[i]
    );
}

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(value) {
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
