import { elements } from './dom.js';

export const themes = [
    { id: 'dark', name: 'Dark' },
    { id: 'light', name: 'Light' },
    // Alphabetical Order
    { id: 'catppuccin', name: 'Catppuccin Mocha' },
    { id: 'dracula', name: 'Dracula' },
    { id: 'gruvbox-dark', name: 'Gruvbox Dark' },
    { id: 'gruvbox-light', name: 'Gruvbox Light' },
    { id: 'midnight', name: 'Midnight Blue' },
    { id: 'rose-pine', name: 'Rosé Pine' },
    { id: 'rose-pine-moon', name: 'Rosé Pine Moon' },
    { id: 'sunset', name: 'Sunset Red' },
    { id: 'tokyo-night', name: 'Tokyo Night' },
    { id: 'tokyo-storm', name: 'Tokyo Night Storm' }
];

export function loadTheme() {
    // Try to get from cookie first
    const savedTheme = getCookie('theme');

    if (savedTheme) {
        setTheme(savedTheme);
    }
    // If no saved theme, the browser will use prefers-color-scheme via CSS
}

export function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    // Update active state in grid if it exists
    if (elements.themeGrid) {
        document.querySelectorAll('.theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.theme === themeName);
        });
    }

    // Save to cookie (and localStorage for backup)
    localStorage.setItem('theme', themeName);
    setCookie('theme', themeName, 365);
}

export function renderThemeGrid() {
    if (!elements.themeGrid) return;

    elements.themeGrid.innerHTML = themes.map(theme => `
        <div class="theme-card ${document.documentElement.getAttribute('data-theme') === theme.id ? 'active' : ''}" 
             data-theme="${theme.id}"
             onclick="window.setTheme('${theme.id}')">
            <div class="theme-preview" data-preview="${theme.id}">
                <div class="theme-preview-header"></div>
                <div class="theme-preview-body"></div>
            </div>
            <div class="theme-card-name">${theme.name}</div>
        </div>
    `).join('');
}

// Expose setTheme to global scope for the inline onclick handler in renderThemeGrid
// A better way would be adding event listeners after rendering, but this is a quick port.
window.setTheme = setTheme;

function setCookie(cname, cvalue, exdays) {
    const d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    let expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    let name = cname + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}
