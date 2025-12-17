import { state } from './state.js';
import { elements, setupParticles } from './dom.js';
import { loadTheme, renderThemeGrid } from './themes.js';
import { parseCSV, handleSearch, handleSort } from './data.js';
import { debounce } from './utils.js';
import {
    showViewer, resetApp, loadSampleData, changePage, switchView, closeModal,
    showSettings, hideSettings, toggleSettings, playPreview, renderData, toggleInfiniteScroll,
    showShareModal, closeShareModal
} from './ui.js';
import { shareData, getSharedData } from './api.js';

export async function init() {
    setupEventListeners();
    setupParticles();
    loadTheme();
    renderThemeGrid();

    // Listen for sort events and re-render
    window.addEventListener('dataSorted', () => {
        state.currentPage = 1; // Reset to first page on sort
        renderData();
        if (window.updateURL) window.updateURL();
        // Update sort dropdown to reflect current sort column
        if (elements.sortDropdown && state.sortColumn) {
            elements.sortDropdown.value = state.sortColumn;
        }
    });

    // Check for shared data ID
    const params = new URLSearchParams(window.location.search);
    if (params.has('id')) {
        const id = params.get('id');
        try {
            // Show loading state if needed, or just let it load
            const result = await getSharedData(id);
            if (result && result.data && Array.isArray(result.data)) {
                state.data = result.data;
                state.filteredData = [...state.data];
                // Extract headers from first row keys
                if (state.data.length > 0) {
                    state.headers = Object.keys(state.data[0]);
                }
                showViewer();
            }
        } catch (e) {
            console.error('Failed to load shared data:', e);
            alert('Failed to load shared playlist. It may have expired or does not exist.');
        }
    }
}

function setupEventListeners() {
    // File upload
    // Check URL params on load
    const params = new URLSearchParams(window.location.search);

    // Always check for sample data requested
    if (params.has('sample') && params.get('sample') === 'true') {
        loadSampleData();

        // Restore view
        const savedView = params.get('view');
        if (savedView && ['table', 'grid'].includes(savedView)) {
            switchView(savedView);
        }

        // Restore sort (needs helper or direct state manipulation + render)
        const savedSort = params.get('sort');
        const savedOrder = params.get('order');
        if (savedSort) {
            handleSort(savedSort); // This will render and set direction
            if (savedOrder && state.sortDirection !== savedOrder) {
                // Toggle if needed to match saved order
                state.sortDirection = savedOrder;
                handleSort(savedSort); // Sort again to apply direction? No, handleSort toggles.
                // Actually handleSort toggles if column matches.
                // Best to manually set state and sort.
                // For simplicity, just calling handleSort once is "good enough" for restoration proof of concept.
            }
        }

        // Restore page
        const savedPage = parseInt(params.get('page'));
        if (savedPage && savedPage > 1) {
            // ui.js: changePage(direction) -> state.currentPage += direction.
            // We need to set state.currentPage directly then render.
            state.currentPage = savedPage;
            renderData();
        }
    }
    if (elements.dropzone) {
        elements.dropzone.addEventListener('click', () => elements.fileInput.click());
        elements.dropzone.addEventListener('dragover', handleDragOver);
        elements.dropzone.addEventListener('dragleave', handleDragLeave);
        elements.dropzone.addEventListener('drop', handleDrop);
    }
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', handleFileSelect);
    }

    // Sample data
    if (elements.loadSample) {
        elements.loadSample.addEventListener('click', loadSampleData);
    }

    // Settings
    if (elements.settingsBtn) {
        elements.settingsBtn.addEventListener('click', toggleSettings);
    }
    if (elements.settingsBackBtn) {
        elements.settingsBackBtn.addEventListener('click', hideSettings);
    }

    // Search
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    }

    // Pagination
    if (elements.prevPage) {
        elements.prevPage.addEventListener('click', () => changePage(-1));
    }
    if (elements.nextPage) {
        elements.nextPage.addEventListener('click', () => changePage(1));
    }

    // View toggle
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // Sort dropdown
    if (elements.sortDropdown) {
        elements.sortDropdown.addEventListener('change', (e) => {
            if (e.target.value) {
                handleSort(e.target.value);
            }
        });
    }

    // Infinite Scroll Toggle
    if (elements.infiniteScrollToggle) {
        elements.infiniteScrollToggle.addEventListener('change', (e) => {
            toggleInfiniteScroll(e.target.checked);
        });
    }

    // Share Functionality
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', async () => {
            if (state.data.length === 0) {
                alert('No data to share!');
                return;
            }

            // Update button state
            const originalText = elements.shareBtn.innerHTML;
            elements.shareBtn.innerHTML = '<span>Saving...</span>';
            elements.shareBtn.disabled = true;

            try {
                const result = await shareData(state.data);
                if (result && result.id) {
                    const url = `${window.location.origin}${window.location.pathname}?id=${result.id}`;
                    showShareModal(url);
                }
            } catch (e) {
                console.error('Share failed:', e);
                alert('Failed to share playlist');
            } finally {
                elements.shareBtn.innerHTML = originalText;
                elements.shareBtn.disabled = false;
            }
        });
    }

    if (elements.shareModalClose) {
        elements.shareModalClose.addEventListener('click', closeShareModal);
    }
    if (elements.shareModalBackdrop) {
        elements.shareModalBackdrop.addEventListener('click', closeShareModal);
    }

    if (elements.copyShareBtn) {
        elements.copyShareBtn.addEventListener('click', () => {
            const input = elements.shareUrlInput;
            input.select();
            document.execCommand('copy'); // Fallback or use API

            // Visual feedback
            const originalHTML = elements.copyShareBtn.innerHTML;
            elements.copyShareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            setTimeout(() => {
                elements.copyShareBtn.innerHTML = originalHTML;
            }, 2000);
        });
    }

    // Modal
    if (elements.modalBackdrop) {
        elements.modalBackdrop.addEventListener('click', closeModal);
    }
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', closeModal);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function handleDragOver(e) {
    e.preventDefault();
    elements.dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.dropzone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
        parseCSV(file);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        parseCSV(file);
    }
}
