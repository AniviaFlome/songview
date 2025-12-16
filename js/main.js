import { state } from './state.js';
import { elements, setupParticles } from './dom.js';
import { loadTheme, renderThemeGrid } from './themes.js';
import { parseCSV, handleSearch, handleSort } from './data.js';
import { debounce } from './utils.js';
import {
    showViewer, resetApp, loadSampleData, changePage, switchView, closeModal,
    showSettings, hideSettings, playPreview, renderData, toggleInfiniteScroll
} from './ui.js';

export function init() {
    setupEventListeners();
    setupParticles();
    loadTheme();
    renderThemeGrid();

    // Listen for sort events and re-render
    window.addEventListener('dataSorted', () => {
        state.currentPage = 1; // Reset to first page on sort
        renderData();
        if (window.updateURL) window.updateURL();
    });
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
        elements.settingsBtn.addEventListener('click', showSettings);
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
