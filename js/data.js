import { state } from './state.js';
import { renderData, updateStats, showViewer } from './ui.js';

export function parseCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const csv = e.target.result;
        const lines = csv.split('\n').filter(line => line.trim());

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
    };
    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

export function handleSearch(e) {
    state.searchQuery = e.target.value.toLowerCase();
    state.currentPage = 1;

    if (!state.searchQuery) {
        state.filteredData = [...state.data];
    } else {
        state.filteredData = state.data.filter(row => {
            return Object.values(row).some(value =>
                String(value).toLowerCase().includes(state.searchQuery)
            );
        });
    }

    updateStats();
    renderData();
}

export function handleSort(column) {
    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        state.sortDirection = 'desc'; // Default to descending
    }

    state.filteredData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Handle null/undefined
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // Numeric sort for specific fields
        if (
            column.toLowerCase().includes('popularity') ||
            column.toLowerCase().includes('duration') ||
            column.toLowerCase() === 'disc number' ||
            column.toLowerCase() === 'track number'
        ) {
            valA = parseInt(valA);
            valB = parseInt(valB);

            // Handle NaN (treat as 0)
            if (isNaN(valA)) valA = 0;
            if (isNaN(valB)) valB = 0;
        } else if (
            column.toLowerCase().includes('added') ||
            column.toLowerCase().includes('date') ||
            column.toLowerCase().includes('release')
        ) {
            // Date sorting
            valA = new Date(valA).getTime() || 0;
            valB = new Date(valB).getTime() || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }

        if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Trigger render (circular dep handled by main or ui usually, but here calling renderData from ui via import would be circular)
    // In strict modules, we return the sorted data or dispatch an event.
    // Since we modifying state in place, UI just needs to re-render.
    // We will dispatch a custom event or let the UI caller handle re-render.
    // Assuming UI imports this, we can't import UI to call renderData.
    // Solution: Dispatch event on window or use callback.
    // Ideally main.js sets this up, but for now we'll trigger a custom event.
    window.dispatchEvent(new CustomEvent('dataSorted'));
}

export function getDisplayHeaders() {
    // Only show these specific columns in order
    const priority = ['Track Name', 'Album Name', 'Track Duration (ms)', 'Popularity'];
    const displayed = [];

    priority.forEach(p => {
        const found = state.headers.find(h => h.toLowerCase() === p.toLowerCase());
        if (found) displayed.push(found);
    });

    // Explicitly exclude these columns - they clutter the table
    const excluded = [
        'added at', 'added by',
        'artist name(s)', 'artist name', 'artists', 'artist',
        'album artist name(s)', 'album artist name', 'album artists',
        'album release date', 'release date',
        'disc number', 'track number',
        'isrc', 'spotify id',
        'explicit', 'explicit?'
    ];

    // Add remaining headers up to limit, excluding unwanted ones
    state.headers.forEach(h => {
        const lower = h.toLowerCase();
        if (!displayed.includes(h) && displayed.length < 5
            && !excluded.includes(lower)
            && !lower.includes('image')
            && !lower.includes('uri')
            && !lower.includes('url')) {
            displayed.push(h);
        }
    });

    return displayed;
}

// Get a cleaner display name for headers
export function getDisplayName(header) {
    const names = {
        'Track Duration (ms)': 'Duration',
        'Artist Name(s)': 'Artist',
        'Album Name': 'Album'
    };
    return names[header] || header;
}

export function findHeader(possibleNames) {
    return state.headers.find(h =>
        possibleNames.some(name => h.toLowerCase() === name.toLowerCase())
    );
}
