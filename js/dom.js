export const elements = {
    uploadSection: document.getElementById('uploadSection'),
    viewerSection: document.getElementById('viewerSection'),
    dropzone: document.getElementById('dropzone'),
    fileInput: document.getElementById('fileInput'),
    loadSample: document.getElementById('loadSample'),
    searchInput: document.getElementById('searchInput'),
    tableView: document.getElementById('tableView'),
    gridView: document.getElementById('gridView'),
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody'),
    pagination: document.getElementById('pagination'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    newFileBtn: document.getElementById('newFileBtn'),
    trackModal: document.getElementById('trackModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalClose: document.getElementById('modalClose'),
    modalBody: document.getElementById('modalBody'),
    totalTracks: document.getElementById('totalTracks'),
    totalArtists: document.getElementById('totalArtists'),
    totalAlbums: document.getElementById('totalAlbums'),
    totalDuration: document.getElementById('totalDuration'),
    particles: document.getElementById('particles'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsSection: document.getElementById('settingsSection'),
    settingsBackBtn: document.getElementById('settingsBackBtn'),
    themeGrid: document.getElementById('themeGrid'),
    sortDropdown: document.getElementById('sortDropdown'),
    infiniteScrollToggle: document.getElementById('infiniteScrollToggle')
};

export function setupParticles() {
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 10}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        elements.particles.appendChild(particle);
    }
}
