/**
 * Updates the theme color meta tag based on the current theme.
 * @param {boolean} isDark - Whether the dark theme is active.
 */
function updateMetaTheme(isDark) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = isDark ? '#0f172a' : '#2563eb';
    }
}

/**
 * Toggles the theme between light and dark modes.
 */
function toggleTheme() {
    const html = document.documentElement;
    const icon = document.getElementById('themeIcon');
    const isDark = html.classList.toggle('dark');

    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    if (icon) {
        if (isDark) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    updateMetaTheme(isDark);
}

/**
 * Initializes the theme based on saved preferences or system settings.
 */
function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved ? saved === 'dark' : (saved === null && prefersDark);

    const html = document.documentElement;
    const icon = document.getElementById('themeIcon');

    if (isDark) {
        html.classList.add('dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        html.classList.remove('dark');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
    updateMetaTheme(isDark);
}

// Initialize theme when script is loaded
// Since this script will be included at the end of the body,
// the themeIcon element will be available.
initTheme();
