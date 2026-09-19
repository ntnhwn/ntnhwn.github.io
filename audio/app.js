const WORKER_URL = "https://audio.tnhan.dev";

const state = {
    books: [],
    filteredBooks: [],
    currentBook: null,
    currentEpisodeIndex: -1,
    isLoading: false
};

const els = {
    folderList: document.getElementById("folderList"),
    searchInput: document.getElementById("searchInput"),
    clearSearch: document.getElementById("clearSearch"),
    libraryDescription: document.getElementById("libraryDescription"),

    loadingState: document.getElementById("libraryLoading"),
    errorState: document.getElementById("libraryError"),
    errorText: document.getElementById("libraryErrorText"),
    emptyState: document.getElementById("libraryEmpty"),

    libraryView: document.getElementById("libraryView"),
    playerView: document.getElementById("playerView"),

    backBtn: document.getElementById("backButton"),
    refreshBtn: document.getElementById("refreshButton"),
    retryBtn: document.getElementById("retryButton"),

    bookTitle: document.getElementById("bookTitle"),
    episodeTitle: document.getElementById("episodeTitle"),
    episodeCount: document.getElementById("episodeCount"),
    episodeList: document.getElementById("episodeList"),
    episodeLoading: document.getElementById("episodeLoading"),

    audioPlayer: document.getElementById("audioPlayer"),

    playBtn: document.getElementById("playButton"),
    prevBtn: document.getElementById("previousButton"),
    nextBtn: document.getElementById("nextButton"),

    progressBar: document.getElementById("progressBar"),
    currentTime: document.getElementById("currentTime"),
    duration: document.getElementById("duration"),

    speedSelect: document.getElementById("speedSelect"),
    rewindBtn: document.getElementById("rewindButton"),
    forwardBtn: document.getElementById("forwardButton"),

    toast: document.getElementById("toast")
};


// ======================================================
// INIT
// ======================================================

document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    loadBooks();
});


// ======================================================
// API
// ======================================================

async function apiFetch(path) {
    const url = `${WORKER_URL}${path}`;

    console.log("[API] GET:", url);

    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/json"
        },
        cache: "no-store"
    });

    console.log(
        "[API] Response:",
        response.status,
        response.statusText
    );

    if (!response.ok) {
        const text = await response.text().catch(() => "");

        console.error("[API] Error:", text);

        throw new Error(
            `HTTP ${response.status} ${response.statusText}`
        );
    }

    const data = await response.json();

    console.log("[API] Data:", data);

    if (data.success === false) {
        throw new Error(
            data.error || "API request failed"
        );
    }

    return data;
}


// ======================================================
// LOAD BOOKS
// ======================================================

async function loadBooks() {
    if (state.isLoading) return;

    state.isLoading = true;

    showLoading();

    try {
        let books = [];

        // ------------------------------------------
        // Lấy danh sách truyện
        // ------------------------------------------

        try {
            const data = await apiFetch("/api/books");

            if (Array.isArray(data.books)) {
                books = data.books;
            }
        } catch (error) {
            console.warn(
                "Không lấy được /api/books:",
                error
            );
        }


        // ------------------------------------------
        // FALLBACK: Audio1
        // ------------------------------------------

        if (books.length === 0) {
            console.log(
                "[API] Fallback → /api/books/Audio1"
            );

            const data =
                await apiFetch("/api/books/Audio1");

            if (data.book) {
                books = [data.book];
            }
        }


        // ------------------------------------------
        // Kiểm tra
        // ------------------------------------------

        if (!Array.isArray(books)) {
            throw new Error(
                "API không trả về danh sách truyện."
            );
        }


        // ------------------------------------------
        // Normalize
        // ------------------------------------------

        state.books =
            books.map(normalizeBook);

        state.filteredBooks =
            [...state.books];


        // ------------------------------------------
        // Render
        // ------------------------------------------

        renderBooks();


        if (state.books.length === 0) {
            showEmpty("Chưa có truyện nào.");
        } else {
            showLibraryLoaded();
        }

    } catch (error) {
        console.error(
            "Load books error:",
            error
        );

        showError(
            "Không thể tải thư viện",
            error.message
        );

    } finally {
        state.isLoading = false;
    }
}


// ======================================================
// LOAD BOOK
// ======================================================

async function loadBook(book) {
    try {
        showToast("Đang tải danh sách tập...");

        const bookId =
            book.slug ||
            book.id;

        if (!bookId) {
            throw new Error(
                "Không xác định được ID truyện."
            );
        }

        const data =
            await apiFetch(
                `/api/books/${encodeURIComponent(bookId)}`
            );

        if (!data.book) {
            throw new Error(
                "API không trả về thông tin truyện."
            );
        }

        state.currentBook =
            normalizeBook(data.book);

        state.currentEpisodeIndex = -1;

        renderPlayer();
        showPlayer();

    } catch (error) {
        console.error(
            "Load book error:",
            error
        );

        showToast(
            `Không thể tải truyện: ${error.message}`
        );
    }
}


// ======================================================
// NORMALIZE BOOK
// ======================================================

function normalizeBook(book) {
    return {
        id:
            book.id ||
            book.slug ||
            "",

        slug:
            book.slug ||
            book.id ||
            "",

        name:
            book.name ||
            book.title ||
            book.slug ||
            "Không tên",

        author:
            book.author ||
            "",

        description:
            book.description ||
            "",

        cover:
            book.cover ||
            book.coverUrl ||
            "",

        path:
            book.path ||
            "",

        episodeCount:
            Number(book.episodeCount) ||
            (
                Array.isArray(book.episodes)
                    ? book.episodes.length
                    : 0
            ),

        episodes:
            Array.isArray(book.episodes)
                ? book.episodes.map(
                    normalizeEpisode
                )
                : []
    };
}


// ======================================================
// NORMALIZE EPISODE
// ======================================================

function normalizeEpisode(
    episode,
    index = 0
) {
    const key =
        episode.key ||
        episode.id ||
        "";

    return {
        id:
            episode.id ||
            key ||
            `${index + 1}`,

        key,

        title:
            episode.title ||
            `Tập ${
                episode.number ||
                index + 1
            }`,

        filename:
            episode.filename ||
            getFilename(key),

        number:
            Number(episode.number) ||
            extractEpisodeNumber(
                episode.filename ||
                key
            ) ||
            index + 1,

        size:
            Number(episode.size) ||
            0,

        uploaded:
            episode.uploaded ||
            "",

        audioUrl:
            episode.audioUrl ||
            buildAudioUrl(key)
    };
}


// ======================================================
// AUDIO URL
// ======================================================

function buildAudioUrl(key) {
    if (!key) {
        return "";
    }

    const encodedKey =
        key
            .split("/")
            .map(part =>
                encodeURIComponent(part)
            )
            .join("/");

    return `${WORKER_URL}/audio/${encodedKey}`;
}


// ======================================================
// RENDER BOOKS
// ======================================================

function renderBooks() {
    if (!els.folderList) {
        console.error(
            "Không tìm thấy #folderList."
        );

        return;
    }

    els.folderList.innerHTML = "";

    if (state.filteredBooks.length === 0) {
        showEmpty(
            "Không tìm thấy truyện phù hợp."
        );

        return;
    }

    hideStates();

    // QUAN TRỌNG:
    // HTML ban đầu có class="hidden"
    els.folderList.classList.remove("hidden");


    state.filteredBooks.forEach(book => {

        const item =
            document.createElement("div");

        item.className =
            "folder-item";


        item.innerHTML = `
            <div class="folder-icon">
                📁
            </div>

            <div class="folder-info">

                <div class="folder-name">
                    ${escapeHtml(book.name)}
                </div>

                <div class="folder-meta">
                    ${book.episodeCount || 0} tập
                    ${
                        book.author
                            ? ` • ${escapeHtml(book.author)}`
                            : ""
                    }
                </div>

                ${
                    book.description
                        ? `
                        <div class="folder-description">
                            ${escapeHtml(
                                book.description
                            )}
                        </div>
                        `
                        : ""
                }

            </div>

            <div class="folder-arrow">
                ›
            </div>
        `;


        item.addEventListener(
            "click",
            () => loadBook(book)
        );


        els.folderList.appendChild(item);
    });
}


// ======================================================
// PLAYER
// ======================================================

function renderPlayer() {
    const book =
        state.currentBook;

    if (!book) return;


    if (els.bookTitle) {
        els.bookTitle.textContent =
            book.name;
    }


    if (els.episodeCount) {
        els.episodeCount.textContent =
            book.episodes.length;
    }


    if (els.episodeTitle) {
        els.episodeTitle.textContent =
            "Chọn một tập để bắt đầu";
    }


    renderEpisodeList();
}


// ======================================================
// EPISODES
// ======================================================

function renderEpisodeList() {
    if (!els.episodeList) {
        return;
    }

    els.episodeList.innerHTML = "";

    const episodes =
        state.currentBook?.episodes ||
        [];


    if (els.episodeLoading) {
        els.episodeLoading.style.display =
            "none";
    }


    episodes.forEach(
        (episode, index) => {

            const item =
                document.createElement("div");

            item.className =
                "episode-item";


            if (
                index ===
                state.currentEpisodeIndex
            ) {
                item.classList.add("active");
            }


            item.innerHTML = `
                <div class="episode-number">
                    ${episode.number || index + 1}
                </div>

                <div class="episode-info">

                    <div class="episode-title">
                        ${escapeHtml(
                            episode.title
                        )}
                    </div>

                    <div class="episode-meta">
                        ${formatFileSize(
                            episode.size
                        )}
                    </div>

                </div>

                <div class="episode-play">
                    ▶
                </div>
            `;


            item.addEventListener(
                "click",
                () => playEpisode(index)
            );


            els.episodeList.appendChild(item);
        }
    );
}


// ======================================================
// PLAY EPISODE
// ======================================================

function playEpisode(index) {
    const book =
        state.currentBook;

    if (!book) return;


    const episode =
        book.episodes[index];

    if (!episode) return;


    const audioUrl =
        episode.audioUrl ||
        buildAudioUrl(episode.key);


    if (!audioUrl) {
        showToast(
            "Không tìm thấy URL audio."
        );

        return;
    }


    console.log(
        "[AUDIO] Playing:",
        audioUrl
    );


    state.currentEpisodeIndex =
        index;


    els.audioPlayer.src =
        audioUrl;

    els.audioPlayer.load();


    if (els.episodeTitle) {
        els.episodeTitle.textContent =
            episode.title;
    }


    renderEpisodeList();


    els.audioPlayer
        .play()
        .then(() => {
            updatePlayButton();
        })
        .catch(error => {

            console.warn(
                "Autoplay bị chặn:",
                error
            );

            updatePlayButton();

            showToast(
                "Hãy bấm nút Play để phát."
            );
        });
}


// ======================================================
// NEXT / PREVIOUS
// ======================================================

function playNext() {
    const episodes =
        state.currentBook?.episodes ||
        [];

    if (episodes.length === 0) {
        return;
    }


    const nextIndex =
        state.currentEpisodeIndex + 1;


    if (nextIndex >= episodes.length) {
        showToast("Đã hết truyện.");
        return;
    }


    playEpisode(nextIndex);
}


function playPrevious() {
    const episodes =
        state.currentBook?.episodes ||
        [];

    if (episodes.length === 0) {
        return;
    }


    let previousIndex =
        state.currentEpisodeIndex - 1;


    if (previousIndex < 0) {
        previousIndex = 0;
    }


    playEpisode(previousIndex);
}


// ======================================================
// SEARCH
// ======================================================

function filterBooks(keyword) {
    const query =
        String(keyword || "")
            .trim()
            .toLowerCase();


    if (!query) {
        state.filteredBooks =
            [...state.books];

    } else {

        state.filteredBooks =
            state.books.filter(book => {

                const text = [
                    book.name,
                    book.author,
                    book.description,
                    book.slug
                ]
                    .join(" ")
                    .toLowerCase();

                return text.includes(query);
            });
    }


    renderBooks();
}


// ======================================================
// EVENTS
// ======================================================

function setupEvents() {

    // Search
    els.searchInput?.addEventListener(
        "input",
        event => {

            filterBooks(
                event.target.value
            );

            if (
                els.clearSearch
            ) {
                els.clearSearch.classList.toggle(
                    "hidden",
                    !event.target.value
                );
            }
        }
    );


    // Clear search
    els.clearSearch?.addEventListener(
        "click",
        () => {

            if (els.searchInput) {
                els.searchInput.value = "";
                els.searchInput.focus();
            }

            state.filteredBooks =
                [...state.books];

            renderBooks();

            els.clearSearch.classList.add(
                "hidden"
            );
        }
    );


    // Refresh
    els.refreshBtn?.addEventListener(
        "click",
        () => {

            if (state.isLoading) {
                return;
            }

            loadBooks();
        }
    );


    // Retry
    els.retryBtn?.addEventListener(
        "click",
        () => {
            loadBooks();
        }
    );


    // Back
    els.backBtn?.addEventListener(
        "click",
        () => {
            showLibrary();
        }
    );


    // Play / pause
    els.playBtn?.addEventListener(
        "click",
        () => {

            if (!els.audioPlayer.src) {

                if (
                    state.currentBook &&
                    state.currentBook.episodes.length
                ) {
                    playEpisode(0);
                }

                return;
            }


            if (
                els.audioPlayer.paused
            ) {

                els.audioPlayer
                    .play()
                    .catch(error => {
                        console.error(
                            "Play error:",
                            error
                        );
                    });

            } else {

                els.audioPlayer.pause();

            }
        }
    );


    // Previous
    els.prevBtn?.addEventListener(
        "click",
        playPrevious
    );


    // Next
    els.nextBtn?.addEventListener(
        "click",
        playNext
    );


    // Rewind
    els.rewindBtn?.addEventListener(
        "click",
        () => {

            els.audioPlayer.currentTime =
                Math.max(
                    0,
                    els.audioPlayer.currentTime -
                    10
                );
        }
    );


    // Forward
    els.forwardBtn?.addEventListener(
        "click",
        () => {

            if (
                !Number.isFinite(
                    els.audioPlayer.duration
                )
            ) {
                return;
            }


            els.audioPlayer.currentTime =
                Math.min(
                    els.audioPlayer.duration,
                    els.audioPlayer.currentTime +
                    30
                );
        }
    );


    // Speed
    els.speedSelect?.addEventListener(
        "change",
        event => {

            els.audioPlayer.playbackRate =
                Number(
                    event.target.value
                );
        }
    );


    // Audio play
    els.audioPlayer?.addEventListener(
        "play",
        updatePlayButton
    );


    // Audio pause
    els.audioPlayer?.addEventListener(
        "pause",
        updatePlayButton
    );


    // Progress
    els.audioPlayer?.addEventListener(
        "timeupdate",
        updateProgress
    );


    // Metadata
    els.audioPlayer?.addEventListener(
        "loadedmetadata",
        updateDuration
    );


    // Can play
    els.audioPlayer?.addEventListener(
        "canplay",
        () => {

            console.log(
                "[AUDIO] Can play:",
                els.audioPlayer.currentSrc
            );
        }
    );


    // End
    els.audioPlayer?.addEventListener(
        "ended",
        playNext
    );


    // Error
    els.audioPlayer?.addEventListener(
        "error",
        () => {

            console.error(
                "[AUDIO] Error:",
                els.audioPlayer.error
            );

            console.error(
                "[AUDIO] URL:",
                els.audioPlayer.currentSrc
            );

            showToast(
                "Không thể phát file audio."
            );
        }
    );


    // Seek
    els.progressBar?.addEventListener(
        "input",
        event => {

            const duration =
                els.audioPlayer.duration;


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }


            const percent =
                Number(
                    event.target.value
                );


            els.audioPlayer.currentTime =
                (percent / 100) *
                duration;
        }
    );
}


// ======================================================
// UI
// ======================================================

function showLibrary() {

    if (els.libraryView) {
        els.libraryView.classList.remove(
            "hidden"
        );
    }


    if (els.playerView) {
        els.playerView.classList.add(
            "hidden"
        );
    }


    if (els.audioPlayer) {
        els.audioPlayer.pause();
    }
}


function showPlayer() {

    if (els.libraryView) {
        els.libraryView.classList.add(
            "hidden"
        );
    }


    if (els.playerView) {
        els.playerView.classList.remove(
            "hidden"
        );
    }
}


function showLoading() {

    hideStates();


    if (els.loadingState) {
        els.loadingState.classList.remove(
            "hidden"
        );
    }


    if (els.folderList) {
        els.folderList.classList.add(
            "hidden"
        );
    }


    if (els.libraryDescription) {
        els.libraryDescription.textContent =
            "Đang tải dữ liệu từ Cloudflare...";
    }
}


function showLibraryLoaded() {

    hideStates();


    if (els.folderList) {
        els.folderList.classList.remove(
            "hidden"
        );
    }


    if (els.libraryDescription) {
        els.libraryDescription.textContent =
            `${state.books.length} truyện`;
    }
}


function showEmpty(message) {

    hideStates();


    if (els.folderList) {
        els.folderList.classList.add(
            "hidden"
        );
    }


    if (els.emptyState) {
        els.emptyState.classList.remove(
            "hidden"
        );
    }


    const text =
        els.emptyState?.querySelector(
            "p"
        );


    if (text) {
        text.textContent =
            message;
    }
}


function showError(
    title,
    detail = ""
) {

    hideStates();


    if (els.folderList) {
        els.folderList.classList.add(
            "hidden"
        );
    }


    if (els.errorState) {
        els.errorState.classList.remove(
            "hidden"
        );
    }


    const titleEl =
        els.errorState?.querySelector(
            "h2"
        );


    if (titleEl) {
        titleEl.textContent =
            title;
    }


    if (els.errorText) {
        els.errorText.textContent =
            detail;
    }
}


function hideStates() {

    if (els.loadingState) {
        els.loadingState.classList.add(
            "hidden"
        );
    }


    if (els.errorState) {
        els.errorState.classList.add(
            "hidden"
        );
    }


    if (els.emptyState) {
        els.emptyState.classList.add(
            "hidden"
        );
    }
}


// ======================================================
// AUDIO UI
// ======================================================

function updatePlayButton() {

    if (!els.playBtn) {
        return;
    }


    const playing =
        els.audioPlayer &&
        !els.audioPlayer.paused;


    els.playBtn.innerHTML =
        playing
            ? "❚❚"
            : "▶";
}


function updateProgress() {

    if (!els.audioPlayer) {
        return;
    }


    const current =
        els.audioPlayer.currentTime ||
        0;


    const duration =
        els.audioPlayer.duration ||
        0;


    if (els.currentTime) {
        els.currentTime.textContent =
            formatTime(current);
    }


    if (
        els.progressBar &&
        Number.isFinite(duration) &&
        duration > 0
    ) {

        els.progressBar.value =
            (current / duration) * 100;
    }
}


function updateDuration() {

    if (!els.audioPlayer) {
        return;
    }


    const duration =
        els.audioPlayer.duration;


    if (els.duration) {
        els.duration.textContent =
            formatTime(duration);
    }


    updateProgress();
}


// ======================================================
// TOAST
// ======================================================

let toastTimer = null;

function showToast(message) {

    if (!els.toast) {
        return;
    }


    els.toast.textContent =
        message;


    els.toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {
                els.toast.classList.remove(
                    "show"
                );
            },
            2500
        );
}


// ======================================================
// HELPERS
// ======================================================

function formatTime(seconds) {

    if (!Number.isFinite(seconds)) {
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

        return [
            String(hours).padStart(2, "0"),
            String(minutes).padStart(2, "0"),
            String(secs).padStart(2, "0")
        ].join(":");
    }


    return [
        String(minutes).padStart(2, "0"),
        String(secs).padStart(2, "0")
    ].join(":");
}


function formatFileSize(bytes) {

    if (
        !bytes ||
        bytes <= 0
    ) {
        return "";
    }


    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];


    let size = bytes;
    let index = 0;


    while (
        size >= 1024 &&
        index < units.length - 1
    ) {
        size /= 1024;
        index++;
    }


    return `${size.toFixed(
        index === 0 ? 0 : 1
    )} ${units[index]}`;
}


function getFilename(key) {

    if (!key) {
        return "";
    }

    return key
        .split("/")
        .pop();
}


function extractEpisodeNumber(
    filename
) {

    const match =
        String(filename).match(
            /\d+/
        );

    return match
        ? Number(match[0])
        : null;
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
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
