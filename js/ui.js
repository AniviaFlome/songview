import { state, sampleData } from './state.js';
import { elements } from './dom.js';
import { escapeHtml, formatDuration, formatTrackDuration, parseCSVLine } from './utils.js';
import { findHeader, getDisplayHeaders, getDisplayName, handleSort } from './data.js';

const PLACEHOLDER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

function getTrackDisplayInfo(row) {
    const trackKey = findHeader(['Track Name', 'Name', 'Track', 'title']);
    const artistKey = findHeader(['Artist Name(s)', 'Artist Name', 'Artists', 'artist']);
    const albumKey = findHeader(['Album Name', 'Album', 'album']);
    const imageKey = findHeader(['Album Image URL', 'Image URL', 'image']);
    const previewKey = findHeader(['Track Preview URL', 'Preview URL', 'preview_url', 'Preview']);

    return {
        trackName: trackKey ? row[trackKey] : 'Unknown Track',
        artistName: artistKey ? row[artistKey] : 'Unknown Artist',
        albumName: albumKey ? row[albumKey] : 'Unknown Album',
        imageSrc: imageKey && row[imageKey] ? row[imageKey] : null,
        previewUrl: previewKey ? row[previewKey] : null
    };
}

export function showViewer() {
    elements.uploadSection.classList.add('hidden');
    elements.viewerSection.classList.remove('hidden');

    updateStats();
    renderData();
}

export function resetApp() {
    state.data = [];
    state.filteredData = [];
    state.headers = [];
    state.currentPage = 1;
    state.searchQuery = '';
    elements.searchInput.value = '';

    elements.viewerSection.classList.add('hidden');
    elements.uploadSection.classList.remove('hidden');
    elements.fileInput.value = '';
}

export function updateStats() {
    // Total tracks
    elements.totalTracks.textContent = state.filteredData.length.toLocaleString();

    // Unique artists
    const artistKey = findHeader(['Artist Name(s)', 'Artist Name', 'Artists', 'artist']);
    if (artistKey) {
        const artists = new Set();
        state.filteredData.forEach(row => {
            const artistVal = row[artistKey];
            if (artistVal) {
                artistVal.split(',').forEach(a => artists.add(a.trim()));
            }
        });
        elements.totalArtists.textContent = artists.size.toLocaleString();
    } else {
        elements.totalArtists.textContent = '-';
    }

    // Unique albums
    const albumKey = findHeader(['Album Name', 'Album', 'album']);
    if (albumKey) {
        const albums = new Set(state.filteredData.map(row => row[albumKey]).filter(Boolean));
        elements.totalAlbums.textContent = albums.size.toLocaleString();
    } else {
        elements.totalAlbums.textContent = '-';
    }

    // Total duration
    const durationKey = findHeader(['Track Duration (ms)', 'Duration (ms)', 'duration_ms', 'Duration']);
    if (durationKey) {
        const totalMs = state.filteredData.reduce((sum, row) => {
            return sum + (parseInt(row[durationKey]) || 0);
        }, 0);
        elements.totalDuration.textContent = formatDuration(totalMs);
    } else {
        elements.totalDuration.textContent = '-';
    }
}

let observer = null;
let eventDelegationSetup = false;

function setupEventDelegation() {
    if (eventDelegationSetup) return;

    // Table Delegation
    elements.tableBody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr');
        const artContainer = e.target.closest('.track-art-container');

        if (artContainer) {
            e.stopPropagation();
            const previewUrl = artContainer.dataset.preview;
            playPreview(previewUrl, artContainer);
            return;
        }

        if (tr && !e.target.closest('.track-cell')) { // Allow text selection? Actually original logic was click row -> modal.
            // Original: click row opens modal, except play button.
            // But artContainer handles play.
            openModal(parseInt(tr.dataset.index));
        } else if (tr) {
            // Also open modal on track text click
            openModal(parseInt(tr.dataset.index));
        }
    });

    // Grid Delegation
    elements.gridView.addEventListener('click', (e) => {
        const artContainer = e.target.closest('.track-art-container');
        const item = e.target.closest('.grid-item');

        if (artContainer && item) {
            e.stopPropagation();
            const previewUrl = artContainer.dataset.preview;
            playPreview(previewUrl, artContainer);
            return;
        }

        if (item) {
            openModal(parseInt(item.dataset.index));
        }
    });

    eventDelegationSetup = true;
}

export function renderData(append = false) {
    setupEventDelegation();

    if (state.currentView === 'table') {
        renderTable(append);
    } else {
        renderGrid(append);
    }
    updatePagination();
    manageInfiniteScroll();
}

function manageInfiniteScroll() {
    // Cleanup old sentinel
    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    if (state.infiniteScroll) {
        if (observer) observer.disconnect();

        const container = state.currentView === 'table' ? elements.tableBody : elements.gridView;
        const sentinel = document.createElement('div');
        sentinel.id = 'scroll-sentinel';
        sentinel.style.height = '20px';
        sentinel.style.width = '100%';

        // Append sentinel to parent of container? 
        // Table: tbody cannot have div child. Sentinel should be tr or after table.
        // If table, append to elements.viewerSection or make a row.
        if (state.currentView === 'table') {
            const row = document.createElement('tr');
            row.id = 'scroll-sentinel';
            row.innerHTML = '<td colspan="100%" style="height: 20px; border: none;"></td>';
            elements.tableBody.appendChild(row);
        } else {
            elements.gridView.appendChild(sentinel);
        }

        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage);
                if (state.currentPage < totalPages) {
                    state.currentPage++;
                    renderData(true);
                }
            }
        }, { rootMargin: '200px' });

        const target = document.getElementById('scroll-sentinel');
        if (target) observer.observe(target);

        elements.pagination.classList.add('hidden');
    } else {
        if (observer) observer.disconnect();
        elements.pagination.classList.remove('hidden');
    }
}

export function renderTable(append = false) {
    const displayHeaders = getDisplayHeaders();

    // Render headers only if not appending
    if (!append) {
        elements.tableHeader.innerHTML = displayHeaders.map(header => {
            const isSorted = state.sortColumn === header;
            const sortIcon = isSorted
                ? (state.sortDirection === 'asc' ? ' ↑' : ' ↓')
                : '';
            const displayName = getDisplayName(header);
            return `<th data-column="${header}" class="${isSorted ? 'sorted' : ''}">${displayName}${sortIcon}</th>`;
        }).join('');

        // Add sort listeners
        elements.tableHeader.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.column));
        });

        elements.tableBody.innerHTML = '';
    }

    // Remove sentinel if exists (it will be re-added)
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) sentinel.remove();

    // Get paginated data
    const start = (state.currentPage - 1) * state.itemsPerPage;
    const pageData = state.filteredData.slice(start, start + state.itemsPerPage);

    const placeholderHTML = `<div class="track-art-placeholder" style="background: var(--gradient-1)">${PLACEHOLDER_SVG}</div>`;

    // Render rows
    const trackKey = findHeader(['Track Name', 'Name', 'Track', 'title']);
    const artistKey = findHeader(['Artist Name(s)', 'Artist Name', 'Artists', 'artist']);

    const rowsHTML = pageData.map((row, index) => {
        const { trackName, artistName, imageSrc, previewUrl } = getTrackDisplayInfo(row);

        const cells = displayHeaders.map(header => {
            if (header === trackKey && trackKey) {
                const dataIndex = start + index;
                const placeholder = `<div class="track-art-placeholder">${PLACEHOLDER_SVG}</div>`;
                const artHtml = imageSrc
                    ? `<img src="${imageSrc}" alt="" class="track-art" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                       <div class="track-art-placeholder" style="display:none; background: var(--gradient-2)">${PLACEHOLDER_SVG}</div>`
                    : placeholder;

                return `<td>
                    <div class="track-cell">
                        <div class="track-art-container" data-preview="${previewUrl || ''}" data-index="${dataIndex}">
                            ${artHtml}
                            <div class="play-overlay">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5,3 19,12 5,21"/>
                                </svg>
                            </div>
                        </div>
                        <div class="track-info">
                            <span class="track-name">${escapeHtml(trackName)}</span>
                            <span class="track-artist">${escapeHtml(artistName)}</span>
                        </div>
                    </div>
                </td>`;
            }

            // Skip artist column if we're showing it in track cell
            if (header === artistKey && trackKey) {
                return null;
            }

            const durationKey = findHeader(['Track Duration (ms)', 'Duration (ms)', 'duration_ms']);
            if (header === durationKey) {
                return `<td>${formatTrackDuration(parseInt(row[header]) || 0)}</td>`;
            }

            return `<td>${escapeHtml(row[header] || '')}</td>`;
        }).filter(Boolean).join('');

        return `<tr data-index="${start + index}">${cells}</tr>`;
    }).join('');

    if (append) {
        elements.tableBody.insertAdjacentHTML('beforeend', rowsHTML);
    } else {
        elements.tableBody.innerHTML = rowsHTML;
    }
}

export function renderGrid(append = false) {
    // Remove sentinel first
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) sentinel.remove();

    const start = (state.currentPage - 1) * state.itemsPerPage;
    const pageData = state.filteredData.slice(start, start + state.itemsPerPage);



    const gridHTML = pageData.map((row, index) => {
        const { trackName, artistName, imageSrc, previewUrl } = getTrackDisplayInfo(row);

        const placeholder = `<div class="track-art-placeholder">${PLACEHOLDER_SVG}</div>`;
        const artHtml = imageSrc
            ? `<img src="${imageSrc}" alt="${escapeHtml(trackName)}" class="track-art" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
               <div class="track-art-placeholder" style="display:none; background: var(--gradient-2)">${PLACEHOLDER_SVG}</div>`
            : placeholder;

        return `
            <div class="grid-item" data-index="${start + index}">
                <div class="track-art-container grid-art" data-preview="${previewUrl || ''}">
            <div class="grid-item" data-index="${start + index}">
                <div class="track-art-container grid-art" data-preview="${previewUrl || ''}">
                    ${artHtml}
                    <div class="play-overlay">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </div>
                </div>
                <div class="grid-item-info">
                    <div class="grid-item-title">${escapeHtml(trackName)}</div>
                    <div class="grid-item-subtitle">${escapeHtml(artistName)}</div>
                </div>
            </div>
        `;
    }).join('');

    if (append) {
        elements.gridView.insertAdjacentHTML('beforeend', gridHTML);
    } else {
        elements.gridView.innerHTML = gridHTML;
    }
}

function updatePagination() {
    const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage) || 1;

    elements.currentPage.textContent = state.currentPage;
    elements.totalPages.textContent = totalPages;

    elements.prevPage.disabled = state.currentPage === 1;
    elements.nextPage.disabled = state.currentPage === totalPages;
}

export function changePage(direction) {
    const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage);
    const newPage = state.currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        state.currentPage = newPage;
        renderData();
        if (window.updateURL) window.updateURL(); // Call if available

        // Scroll to top of viewer
        elements.viewerSection.scrollIntoView({ behavior: 'smooth' });
    }
}

export function switchView(view) {
    state.currentView = view;

    // Stop any playing audio when switching views
    stopPreview();

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    elements.tableView.classList.toggle('hidden', view !== 'table');
    elements.gridView.classList.toggle('hidden', view !== 'grid');

    renderData();
    if (window.updateURL) window.updateURL(); // Call if available
}

// Modal handling
export function openModal(index) {
    const track = state.filteredData[index];
    if (!track) return;

    const trackKey = findHeader(['Track Name', 'Name', 'Track', 'title']);
    const artistKey = findHeader(['Artist Name(s)', 'Artist Name', 'Artists', 'artist']);
    const albumKey = findHeader(['Album Name', 'Album', 'album']);
    const imageKey = findHeader(['Album Image URL', 'Image URL', 'image']);
    const previewKey = findHeader(['Track Preview URL', 'Preview URL', 'preview_url']);

    const { trackName, artistName, albumName, imageSrc, previewUrl } = getTrackDisplayInfo(track);

    // Filter keys
    const excludeKeys = [
        trackKey, artistKey, albumKey, imageKey, previewKey,
        'Track URI', 'Artist URI(s)', 'Album URI', 'Album Artist URI(s)',
        'Added By', 'Added At',
        'Album Artist Name(s)', 'Album Release Date', 'Disc Number', 'Track Number',
        'Track Duration (ms)', 'Explicit', 'Popularity', 'ISRC', 'Explicit?'
    ].filter(Boolean);

    const formatValue = (key, value) => {
        if (typeof value === 'string' && value.startsWith('spotify:')) {
            const parts = value.split(':');
            const type = parts[1];
            const id = parts[2];
            return `<a href="https://open.spotify.com/${type}/${id}" target="_blank" class="spotify-link">
                Open in Spotify
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
            </a>`;
        }

        if (key.toLowerCase().includes('duration')) {
            return formatTrackDuration(parseInt(value) || 0);
        }

        if (key.toLowerCase().includes('date')) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        }

        return escapeHtml(String(value));
    };

    const details = Object.entries(track)
        .filter(([key, value]) => !excludeKeys.includes(key))
        .map(([key, value]) => {
            if (value === null || value === undefined || value === '') return '';
            return `
                <div class="detail-item">
                    <div class="detail-label">${escapeHtml(key)}</div>
                    <div class="detail-value">${formatValue(key, value)}</div>
                </div>
            `;
        }).join('');



    elements.modalBody.innerHTML = `
        <div class="modal-header">
            ${imageSrc
            ? `<img src="${imageSrc}" alt="" class="modal-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
               <div class="modal-image-placeholder" style="display:none; background: var(--gradient-2)">${PLACEHOLDER_SVG}</div>`
            : `<div class="modal-image-placeholder">
                    ${PLACEHOLDER_SVG}
                </div>`
        }
            <div class="modal-title-section">
                <h2 class="modal-title">
                    ${track['Track URI']
            ? `<a href="https://open.spotify.com/track/${track['Track URI'].split(':')[2]}" target="_blank" class="spotify-redirect-link">${escapeHtml(trackName)}</a>`
            : escapeHtml(trackName)
        }
                </h2>
                <p class="modal-subtitle">
                    ${track['Artist URI(s)'] && track[artistKey]
            ? (() => {
                // Handle multiple artists - each with their own link
                const artistNames = track[artistKey].split(',').map(a => a.trim());
                const artistUris = track['Artist URI(s)'].split(',').map(u => u.trim());

                return artistNames.map((name, i) => {
                    const uri = artistUris[i];
                    if (uri) {
                        const artistId = uri.split(':')[2];
                        return `<a href="https://open.spotify.com/artist/${artistId}" target="_blank" class="spotify-redirect-link">${escapeHtml(name)}</a>`;
                    }
                    return escapeHtml(name);
                }).join(', ');
            })()
            : escapeHtml(artistName)
        }
                </p>
                <p class="modal-meta">
                    ${track['Album URI']
            ? `<a href="https://open.spotify.com/album/${track['Album URI'].split(':')[2]}" target="_blank" class="spotify-redirect-link">${escapeHtml(albumName)}</a>`
            : escapeHtml(albumName)
        }
                </p>
                ${previewUrl ? `
                    <div class="audio-player-container">
                        <audio controls class="custom-audio-player" src="${previewUrl}">
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                ` : ''}
            </div>
        </div>
        <div class="modal-details">
            <div class="detail-grid">
                ${details}
            </div>
        </div>
    `;

    elements.trackModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    elements.trackModal.classList.add('hidden');
    document.body.style.overflow = '';
    // Stop audio
    const audios = document.getElementsByTagName('audio');
    for (let i = 0; i < audios.length; i++) audios[i].pause();
}

// Audio Preview - Spotify Style Circular Progress
let currentAudio = null;
let currentPlayingElement = null;
let progressInterval = null;

export function playPreview(url, element) {
    // If no URL, do not activate player
    if (!url) {
        console.log('Audio preview not available');
        return;
    }

    // Stop any existing playback
    if (currentAudio) {
        stopPreview();
    }

    // Always show visual overlay on the element
    currentPlayingElement = element;
    if (element) {
        // Create overlay FIRST, then add playing class to prevent flicker
        createProgressOverlay(element, false);
        element.classList.add('playing');
    }

    currentAudio = new Audio(url);
    currentAudio.volume = 0.5;

    currentAudio.play().catch(() => {
        // Audio failed to load/play - still show visual
        console.log('Audio preview playback failed');
    });

    // Update progress
    progressInterval = setInterval(() => {
        if (currentAudio && currentPlayingElement) {
            const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
            updateProgress(progress);
        }
    }, 50);

    currentAudio.onended = () => {
        stopPreview();
    };
}

function createProgressOverlay(element, noAudio = false) {
    // Remove existing overlay
    const existing = element.querySelector('.audio-progress-overlay');
    if (existing) existing.remove();

    const circumference = 2 * Math.PI * 18; // r=18

    const overlay = document.createElement('div');
    overlay.className = 'audio-progress-overlay';

    // Show different icon based on whether audio is available
    const icon = noAudio
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>` // Play icon (no audio available)
        : `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`; // Pause icon

    overlay.innerHTML = `
        <svg class="progress-ring" viewBox="0 0 44 44">
            <circle class="progress-ring-bg" cx="22" cy="22" r="18" fill="none" stroke-width="3"
                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: 0"/>
            <circle class="progress-ring-fill" cx="22" cy="22" r="18" fill="none" stroke-width="3"
                    style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${noAudio ? 0 : circumference}"/>
        </svg>
        <div class="pause-icon">${icon}</div>
    `;
    overlay.onclick = (e) => {
        e.stopPropagation();
        stopPreview();
    };
    element.style.position = 'relative';
    element.appendChild(overlay);
}

function updateProgress(percent) {
    const circle = document.querySelector('.progress-ring-fill');
    if (circle) {
        const circumference = 2 * Math.PI * 18;
        const offset = circumference - (percent / 100) * circumference;
        circle.style.strokeDasharray = `${circumference}`;
        circle.style.strokeDashoffset = offset;
    }
}

export function stopPreview() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    if (currentPlayingElement) {
        // Remove overlay FIRST, then remove playing class to prevent flicker
        const overlay = currentPlayingElement.querySelector('.audio-progress-overlay');
        if (overlay) overlay.remove();

        // Add temporary class to block hover effect, then remove after a frame
        currentPlayingElement.classList.add('just-stopped');
        currentPlayingElement.classList.remove('playing');

        const el = currentPlayingElement;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.classList.remove('just-stopped');
            });
        });

        currentPlayingElement = null;
    }
}

// Expose playPreview globally
window.playPreview = playPreview;
window.stopPreview = stopPreview;

// Sample Data Loading - fetch from CSV file
export async function loadSampleData() {
    try {
        const response = await fetch('sample.csv');
        const csvText = await response.text();
        const lines = csvText.split('\n').filter(line => line.trim());

        if (lines.length < 2) return;

        // Parse headers
        state.headers = parseCSVLine(lines[0]);

        // Parse data
        state.data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === state.headers.length) {
                const row = {};
                state.headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                state.data.push(row);
            }
        }

        state.filteredData = [...state.data];
        state.currentPage = 1;

        showViewer();
    } catch (error) {
        console.error('Error loading sample data:', error);
    }
}



// Settings Views
export function showSettings() {
    elements.uploadSection.classList.add('hidden');
    elements.viewerSection.classList.add('hidden');
    elements.settingsSection.classList.remove('hidden');
}

export function hideSettings() {
    // Add closing animation
    elements.settingsSection.classList.add('closing');

    // Wait for animation to complete before hiding
    setTimeout(() => {
        elements.settingsSection.classList.remove('closing');
        elements.settingsSection.classList.add('hidden');
        if (state.data.length > 0) {
            elements.viewerSection.classList.remove('hidden');
        } else {
            elements.uploadSection.classList.remove('hidden');
        }
    }, 200); // Match animation duration
}

export function toggleSettings() {
    // Don't toggle if closing animation is in progress
    if (elements.settingsSection.classList.contains('closing')) {
        return;
    }

    if (elements.settingsSection.classList.contains('hidden')) {
        showSettings();
    } else {
        hideSettings();
    }
}

export function toggleInfiniteScroll(enabled) {
    state.infiniteScroll = enabled;
    // Save to local storage? No request for it, but good practice.
    // Reset view to apply changes
    state.currentPage = 1;
    renderData();
}

export function showShareModal(url) {
    elements.shareUrlInput.value = url;
    elements.shareModal.classList.remove('hidden');
    elements.shareUrlInput.select();
}

export function closeShareModal() {
    elements.shareModal.classList.add('hidden');
}
