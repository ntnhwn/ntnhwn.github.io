"use strict";

/*
|--------------------------------------------------------------------------
| CONFIG
|--------------------------------------------------------------------------
*/

/*
 * GitHub repository chứa metadata.
 *
 * Ví dụ:
 * https://github.com/ntnhwn/audio
 *
 * thì:
 *
 * OWNER = "ntnhwn"
 * REPO  = "audio"
 * BRANCH = "main"
 */

const GITHUB_OWNER = "ntnhwn";
const GITHUB_REPO = "audio";
const GITHUB_BRANCH = "main";

const GITHUB_DATA_PATH = "data";

/*
 * Cloudflare Worker
 */
const WORKER_URL = "https://audio.thnhan.dev";


/*
|--------------------------------------------------------------------------
| GITHUB URL
|--------------------------------------------------------------------------
*/

function githubRawUrl(path) {
    return (
        `https://raw.githubusercontent.com/` +
        `${GITHUB_OWNER}/` +
        `${GITHUB_REPO}/` +
        `${GITHUB_BRANCH}/` +
        `${path}`
    );
}


/*
|--------------------------------------------------------------------------
| DOM
|--------------------------------------------------------------------------
*/

const elements = {
    libraryView: document.getElementById("libraryView"),
    playerView: document.getElementById("playerView"),

    libraryDescription:
        document.getElementById("libraryDescription"),

    libraryLoading:
        document.getElementById("libraryLoading"),

    libraryError:
        document.getElementById("libraryError"),

    libraryErrorText:
        document.getElementById("libraryErrorText"),

    libraryEmpty:
        document.getElementById("libraryEmpty"),

    folderList:
        document.getElementById("folderList"),

    searchInput:
        document.getElementById("searchInput"),

    clearSearch:
        document.getElementById("clearSearch"),

    retryButton:
        document.getElementById("retryButton"),

    refreshButton:
        document.getElementById("refreshButton"),

    backButton:
        document.getElementById("backButton"),

    bookTitle:
        document.getElementById("bookTitle"),

    episodeTitle:
        document.getElementById("episodeTitle"),

    audioPlayer:
        document.getElementById("audioPlayer"),

    currentTime:
        document.getElementById("currentTime"),

    duration:
        document.getElementById("duration"),

    progressBar:
        document.getElementById("progressBar"),

    playButton:
        document.getElementById("playButton"),

    previousButton:
        document.getElementById("previousButton"),

    nextButton:
        document.getElementById("nextButton"),

    speedSelect:
        document.getElementById("speedSelect"),

    rewindButton:
        document.getElementById("rewindButton"),

    forwardButton:
        document.getElementById("forwardButton"),

    episodeCount:
        document.getElementById("episodeCount"),

    episodeLoading:
        document.getElementById("episodeLoading"),

    episodeList:
        document.getElementById("episodeList"),

    toast:
        document.getElementById("toast"),
};


/*
|--------------------------------------------------------------------------
| STATE
|--------------------------------------------------------------------------
*/

let books = [];

let currentBook = null;

let currentEpisodes = [];

let currentEpisodeIndex = -1;

let toastTimer = null;


/*
|--------------------------------------------------------------------------
| INIT
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", () => {

    setupEvents();

    loadBooks();

});


/*
|--------------------------------------------------------------------------
| EVENTS
|--------------------------------------------------------------------------
*/

function setupEvents() {

    elements.refreshButton.addEventListener(
        "click",
        () => {
            loadBooks(true);
        }
    );


    elements.retryButton.addEventListener(
        "click",
        () => {
            loadBooks(true);
        }
    );


    elements.backButton.addEventListener(
        "click",
        () => {
            showLibrary();
        }
    );


    elements.searchInput.addEventListener(
        "input",
        filterBooks
    );


    elements.clearSearch.addEventListener(
        "click",
        () => {

            elements.searchInput.value = "";

            filterBooks();

            elements.searchInput.focus();

        }
    );


    elements.playButton.addEventListener(
        "click",
        togglePlay
    );


    elements.previousButton.addEventListener(
        "click",
        playPrevious
    );


    elements.nextButton.addEventListener(
        "click",
        playNext
    );


    elements.rewindButton.addEventListener(
        "click",
        () => {

            if (!elements.audioPlayer.duration) {
                return;
            }

            elements.audioPlayer.currentTime = Math.max(
                0,
                elements.audioPlayer.currentTime - 10
            );

        }
    );


    elements.forwardButton.addEventListener(
        "click",
        () => {

            if (!elements.audioPlayer.duration) {
                return;
            }

            elements.audioPlayer.currentTime = Math.min(
                elements.audioPlayer.duration,
                elements.audioPlayer.currentTime + 30
            );

        }
    );


    elements.speedSelect.addEventListener(
        "change",
        () => {

            elements.audioPlayer.playbackRate =
                Number(elements.speedSelect.value);

        }
    );


    elements.progressBar.addEventListener(
        "input",
        () => {

            const duration =
                elements.audioPlayer.duration;

            if (!duration) {
                return;
            }

            const percentage =
                Number(elements.progressBar.value);

            elements.audioPlayer.currentTime =
                duration * percentage / 100;

        }
    );


    elements.audioPlayer.addEventListener(
        "timeupdate",
        updateProgress
    );


    elements.audioPlayer.addEventListener(
        "loadedmetadata",
        updateDuration
    );


    elements.audioPlayer.addEventListener(
        "play",
        () => {
            elements.playButton.textContent = "⏸";
        }
    );


    elements.audioPlayer.addEventListener(
        "pause",
        () => {
            elements.playButton.textContent = "▶";
        }
    );


    elements.audioPlayer.addEventListener(
        "ended",
        () => {

            elements.playButton.textContent = "▶";

            playNext();

        }
    );


    elements.audioPlayer.addEventListener(
        "error",
        () => {

            showToast(
                "Không thể phát file audio"
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| LOAD BOOKS
|--------------------------------------------------------------------------
*/

async function loadBooks(forceRefresh = false) {

    showLibraryLoading();

    try {

        const cacheBust = forceRefresh
            ? `?t=${Date.now()}`
            : "";

        const url =
            githubRawUrl(
                `${GITHUB_DATA_PATH}/books.json`
            ) +
            cacheBust;


        const response =
            await fetch(url, {
                cache: forceRefresh
                    ? "no-store"
                    : "default"
            });


        if (!response.ok) {

            throw new Error(
                `GitHub HTTP ${response.status}`
            );

        }


        const data =
            await response.json();


        /*
         * Hỗ trợ cả:
         *
         * {
         *   "books": [...]
         * }
         *
         * và:
         *
         * [...]
         */

        if (Array.isArray(data)) {

            books = data;

        } else if (
            data &&
            Array.isArray(data.books)
        ) {

            books = data.books;

        } else {

            throw new Error(
                "books.json không đúng định dạng"
            );

        }


        books = books.map(normalizeBook);


        renderBooks();


        elements.libraryDescription.textContent =
            `${books.length} truyện trong thư viện`;

    } catch (error) {

        console.error(error);

        showLibraryError(
            error.message ||
            "Không thể tải dữ liệu từ GitHub."
        );

    }

}


/*
|--------------------------------------------------------------------------
| NORMALIZE BOOK
|--------------------------------------------------------------------------
*/

function normalizeBook(book) {

    const id =
        String(
            book.id ??
            book.slug ??
            book.path ??
            ""
        );


    const name =
        String(
            book.name ??
            book.title ??
            id
        );


    return {
        ...book,

        id,
        slug:
            String(
                book.slug ??
                id
            ),

        name,

        path:
            String(
                book.path ??
                id
            ),

        description:
            book.description ??
            "",

        author:
            book.author ??
            "",

        cover:
            book.cover ??
            ""
    };

}


/*
|--------------------------------------------------------------------------
| RENDER BOOKS
|--------------------------------------------------------------------------
*/

function renderBooks() {

    const keyword =
        elements.searchInput.value
            .trim()
            .toLowerCase();


    const filtered =
        books.filter(book => {

            if (!keyword) {
                return true;
            }

            const text = [
                book.name,
                book.title,
                book.author,
                book.description,
                book.slug
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();


            return text.includes(keyword);

        });


    elements.folderList.innerHTML = "";


    if (filtered.length === 0) {

        elements.folderList.classList.add(
            "hidden"
        );

        elements.libraryEmpty.classList.remove(
            "hidden"
        );

        return;

    }


    elements.libraryEmpty.classList.add(
        "hidden"
    );

    elements.folderList.classList.remove(
        "hidden"
    );


    filtered.forEach(
        (book, index) => {

            const card =
                createBookCard(
                    book,
                    index
                );

            elements.folderList.appendChild(
                card
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| BOOK CARD
|--------------------------------------------------------------------------
*/

function createBookCard(book, index) {

    const button =
        document.createElement("button");


    button.type = "button";

    button.className =
        "book-card";


    /*
     * Cover
     */

    const cover =
        document.createElement("div");

    cover.className =
        "book-cover";


    if (book.cover) {

        const image =
            document.createElement("img");

        image.src = book.cover;

        image.alt =
            book.name;

        image.loading = "lazy";

        cover.appendChild(image);

    } else {

        const icon =
            document.createElement("span");

        icon.textContent = "🎧";

        cover.appendChild(icon);

    }


    /*
     * Content
     */

    const content =
        document.createElement("div");

    content.className =
        "book-card-content";


    const title =
        document.createElement("h2");

    title.textContent =
        book.name;


    const meta =
        document.createElement("p");

    meta.textContent =
        book.author ||
        "Thư viện audio";


    content.appendChild(title);

    content.appendChild(meta);


    /*
     * Arrow
     */

    const arrow =
        document.createElement("span");

    arrow.className =
        "book-card-arrow";

    arrow.textContent =
        "›";


    button.appendChild(cover);

    button.appendChild(content);

    button.appendChild(arrow);


    button.addEventListener(
        "click",
        () => {
            openBook(book);
        }
    );


    return button;

}


/*
|--------------------------------------------------------------------------
| OPEN BOOK
|--------------------------------------------------------------------------
*/

async function openBook(book) {

    currentBook = book;

    currentEpisodes = [];

    currentEpisodeIndex = -1;


    elements.libraryView.classList.add(
        "hidden"
    );

    elements.playerView.classList.remove(
        "hidden"
    );


    elements.bookTitle.textContent =
        book.name;

    elements.episodeTitle.textContent =
        "Đang tải danh sách tập...";


    elements.episodeList.innerHTML = "";

    elements.episodeCount.textContent =
        "0";

    elements.episodeLoading.classList.remove(
        "hidden"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    try {

        const data =
            await loadBookEpisodes(
                book
            );


        currentEpisodes =
            data.episodes || [];


        renderEpisodes();


        if (currentEpisodes.length > 0) {

            selectEpisode(0, false);

        } else {

            elements.episodeTitle.textContent =
                "Chưa có tập nào";

        }

    } catch (error) {

        console.error(error);

        elements.episodeTitle.textContent =
            "Không thể tải danh sách tập";

        showToast(
            "Không thể tải dữ liệu tập truyện"
        );

    } finally {

        elements.episodeLoading.classList.add(
            "hidden"
        );

    }

}


/*
|--------------------------------------------------------------------------
| LOAD EPISODES
|--------------------------------------------------------------------------
*/

async function loadBookEpisodes(book) {

    /*
     * Ưu tiên file JSON trên GitHub.
     *
     * Ví dụ:
     *
     * data/Audio1.json
     */

    const path =
        `${GITHUB_DATA_PATH}/${encodeURIComponent(book.slug)}.json`;


    const url =
        githubRawUrl(path) +
        `?t=${Date.now()}`;


    const response =
        await fetch(url, {
            cache: "no-store"
        });


    if (!response.ok) {

        throw new Error(
            `GitHub HTTP ${response.status}`
        );

    }


    const data =
        await response.json();


    let episodes;


    if (Array.isArray(data)) {

        episodes = data;

    } else if (
        data &&
        Array.isArray(data.episodes)
    ) {

        episodes = data.episodes;

    } else {

        throw new Error(
            "File truyện không đúng định dạng"
        );

    }


    episodes =
        episodes.map(
            normalizeEpisode
        );


    return {
        episodes
    };

}


/*
|--------------------------------------------------------------------------
| NORMALIZE EPISODE
|--------------------------------------------------------------------------
*/

function normalizeEpisode(
    episode,
    index
) {

    const number =
        Number(
            episode.number ??
            episode.episode ??
            index + 1
        );


    const title =
        String(
            episode.title ??
            episode.name ??
            `Tập ${number}`
        );


    /*
     * key là đường dẫn trong R2.
     *
     * Ví dụ:
     *
     * Audio1/001.mp3
     */

    let key =
        episode.key ??
        episode.audioKey ??
        episode.file ??
        episode.path;


    if (!key) {

        key =
            `${currentBook.slug}/${String(number).padStart(3, "0")}.mp3`;

    }


    key =
        String(key)
            .replace(/^\/+/, "");


    /*
     * Nếu JSON chỉ ghi:
     *
     * 001.mp3
     *
     * thì tự thêm tên truyện.
     */

    if (
        !key.includes("/")
    ) {

        key =
            `${currentBook.slug}/${key}`;

    }


    return {

        ...episode,

        number,

        title,

        key,

        audioUrl:
            `${WORKER_URL}/audio/` +
            encodeR2Key(key)

    };

}


/*
|--------------------------------------------------------------------------
| ENCODE R2 KEY
|--------------------------------------------------------------------------
*/

function encodeR2Key(key) {

    return key
        .split("/")
        .map(
            part =>
                encodeURIComponent(part)
        )
        .join("/");

}


/*
|--------------------------------------------------------------------------
| RENDER EPISODES
|--------------------------------------------------------------------------
*/

function renderEpisodes() {

    elements.episodeList.innerHTML = "";

    elements.episodeCount.textContent =
        String(
            currentEpisodes.length
        );


    if (
        currentEpisodes.length === 0
    ) {

        elements.episodeList.innerHTML = `
            <div class="episode-empty">
                Chưa có tập nào.
            </div>
        `;

        return;

    }


    currentEpisodes.forEach(
        (episode, index) => {

            const item =
                document.createElement("button");


            item.type = "button";

            item.className =
                "episode-item";


            /*
             * Number
             */

            const number =
                document.createElement("span");

            number.className =
                "episode-number";

            number.textContent =
                String(
                    episode.number
                );


            /*
             * Content
             */

            const content =
                document.createElement("span");

            content.className =
                "episode-content";


            const title =
                document.createElement("span");

            title.className =
                "episode-title";

            title.textContent =
                episode.title;


            content.appendChild(
                title
            );


            /*
             * Play icon
             */

            const icon =
                document.createElement("span");

            icon.className =
                "episode-play";

            icon.textContent =
                "▶";


            item.appendChild(
                number
            );

            item.appendChild(
                content
            );

            item.appendChild(
                icon
            );


            item.addEventListener(
                "click",
                () => {

                    selectEpisode(
                        index,
                        true
                    );

                }
            );


            elements.episodeList.appendChild(
                item
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| SELECT EPISODE
|--------------------------------------------------------------------------
*/

function selectEpisode(
    index,
    autoplay = false
) {

    if (
        index < 0 ||
        index >= currentEpisodes.length
    ) {
        return;
    }


    currentEpisodeIndex =
        index;


    const episode =
        currentEpisodes[index];


    elements.episodeTitle.textContent =
        episode.title;


    elements.audioPlayer.pause();


    elements.audioPlayer.src =
        episode.audioUrl;


    elements.audioPlayer.playbackRate =
        Number(
            elements.speedSelect.value
        );


    elements.audioPlayer.load();


    updateEpisodeActiveState();


    if (autoplay) {

        const playPromise =
            elements.audioPlayer.play();


        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(
                error => {
                    console.warn(
                        "Autoplay blocked:",
                        error
                    );
                }
            );

        }

    }

}


/*
|--------------------------------------------------------------------------
| ACTIVE EPISODE
|--------------------------------------------------------------------------
*/

function updateEpisodeActiveState() {

    const items =
        elements.episodeList.querySelectorAll(
            ".episode-item"
        );


    items.forEach(
        (item, index) => {

            item.classList.toggle(
                "active",
                index ===
                    currentEpisodeIndex
            );

        }
    );

}


/*
|--------------------------------------------------------------------------
| PLAY / PAUSE
|--------------------------------------------------------------------------
*/

function togglePlay() {

    if (
        !elements.audioPlayer.src
    ) {

        if (
            currentEpisodes.length > 0
        ) {

            selectEpisode(
                currentEpisodeIndex >= 0
                    ? currentEpisodeIndex
                    : 0,
                true
            );

        }

        return;

    }


    if (
        elements.audioPlayer.paused
    ) {

        elements.audioPlayer.play();

    } else {

        elements.audioPlayer.pause();

    }

}


/*
|--------------------------------------------------------------------------
| PREVIOUS
|--------------------------------------------------------------------------
*/

function playPrevious() {

    if (
        currentEpisodes.length === 0
    ) {
        return;
    }


    const previous =
        currentEpisodeIndex - 1;


    if (previous >= 0) {

        selectEpisode(
            previous,
            true
        );

    } else {

        elements.audioPlayer.currentTime =
            0;

    }

}


/*
|--------------------------------------------------------------------------
| NEXT
|--------------------------------------------------------------------------
*/

function playNext() {

    if (
        currentEpisodes.length === 0
    ) {
        return;
    }


    const next =
        currentEpisodeIndex + 1;


    if (
        next <
        currentEpisodes.length
    ) {

        selectEpisode(
            next,
            true
        );

    } else {

        showToast(
            "Đã hết các tập"
        );

    }

}


/*
|--------------------------------------------------------------------------
| PROGRESS
|--------------------------------------------------------------------------
*/

function updateProgress() {

    const player =
        elements.audioPlayer;


    if (
        !Number.isFinite(
            player.duration
        ) ||
        player.duration <= 0
    ) {

        return;

    }


    const percentage =
        (
            player.currentTime /
            player.duration
        ) * 100;


    elements.progressBar.value =
        percentage;


    elements.currentTime.textContent =
        formatTime(
            player.currentTime
        );

}


/*
|--------------------------------------------------------------------------
| DURATION
|--------------------------------------------------------------------------
*/

function updateDuration() {

    const duration =
        elements.audioPlayer.duration;


    if (
        Number.isFinite(duration)
    ) {

        elements.duration.textContent =
            formatTime(duration);

    }

}


/*
|--------------------------------------------------------------------------
| TIME FORMAT
|--------------------------------------------------------------------------
*/

function formatTime(seconds) {

    if (
        !Number.isFinite(seconds) ||
        seconds < 0
    ) {

        return "00:00";

    }


    seconds =
        Math.floor(seconds);


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


/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

function filterBooks() {

    const hasSearch =
        elements.searchInput.value.trim()
            .length > 0;


    elements.clearSearch.classList.toggle(
        "hidden",
        !hasSearch
    );


    renderBooks();

}


/*
|--------------------------------------------------------------------------
| SHOW LIBRARY
|--------------------------------------------------------------------------
*/

function showLibrary() {

    elements.audioPlayer.pause();

    elements.audioPlayer.removeAttribute(
        "src"
    );

    elements.audioPlayer.load();


    elements.playerView.classList.add(
        "hidden"
    );

    elements.libraryView.classList.remove(
        "hidden"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


/*
|--------------------------------------------------------------------------
| LOADING
|--------------------------------------------------------------------------
*/

function showLibraryLoading() {

    elements.libraryLoading.classList.remove(
        "hidden"
    );

    elements.libraryError.classList.add(
        "hidden"
    );

    elements.libraryEmpty.classList.add(
        "hidden"
    );

    elements.folderList.classList.add(
        "hidden"
    );

}


/*
|--------------------------------------------------------------------------
| ERROR
|--------------------------------------------------------------------------
*/

function showLibraryError(message) {

    elements.libraryLoading.classList.add(
        "hidden"
    );

    elements.libraryError.classList.remove(
        "hidden"
    );

    elements.libraryEmpty.classList.add(
        "hidden"
    );

    elements.folderList.classList.add(
        "hidden"
    );


    elements.libraryErrorText.textContent =
        message ||
        "Không thể tải dữ liệu từ GitHub.";

}


/*
|--------------------------------------------------------------------------
| LOADED
|--------------------------------------------------------------------------
*/

function showLibraryLoaded() {

    elements.libraryLoading.classList.add(
        "hidden"
    );

    elements.libraryError.classList.add(
        "hidden"
    );

}


/*
|--------------------------------------------------------------------------
| TOAST
|--------------------------------------------------------------------------
*/

function showToast(message) {

    elements.toast.textContent =
        message;


    elements.toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                elements.toast.classList.remove(
                    "show"
                );

            },
            2500
        );

}
