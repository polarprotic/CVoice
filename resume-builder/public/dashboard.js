/**
 * dashboard.js
 * 
 * Handles saved resume fetching and deletion.
 * This file runs AFTER the inline script in dashboard.html,
 * so it overrides fetchSavedResumes with a fully compatible version.
 */

const TEMPLATE_DISPLAY_NAMES = {
    'academic':   'Technical Executive',
    'minimal':    'Sleek Minimalist',
    'modern':     'Contemporary Creative',
    'attorney':   'Traditional Corporate',
    'innovative': 'Executive Innovative',
    'custom':     'Customised Layout'
};

/**
 * Build skeleton loading cards that look like mini resume documents.
 */
function buildSkeletonLoader(count = 2) {
    const lines = [
        ['thick w55'],
        ['spacer'],
        ['w90'],['w70'],['w80'],
        ['spacer'],
        ['w65'],['w45'],['w80'],['w55'],
        ['spacer'],
        ['w40'],['w70']
    ];
    const docInner = lines.map(([cls]) =>
        cls === 'spacer'
            ? '<div class="sk-doc-spacer"></div>'
            : `<div class="sk-doc-line ${cls}"></div>`
    ).join('');

    const card = () => `
        <div class="skeleton-card">
            <div class="sk-doc-wrap">
                <div class="sk-doc">
                    <div class="sk-doc-inner">${docInner}</div>
                </div>
            </div>
            <div class="sk-bar title"></div>
            <div class="sk-bar meta"></div>
            <div class="sk-bar date"></div>
            <div class="sk-bar btn"></div>
        </div>`;
    return Array.from({ length: count }, card).join('');
}

/**
 * Fetch and render saved resumes.
 * Handles both API response shapes:
 *   - { data: [...] }   (original /api/resume/user/:id endpoint)
 *   - [...] plain array (query-param endpoint /api/resume?userId=...)
 */
async function fetchSavedResumes() {
    const userId = localStorage.getItem('userId');
    const token  = localStorage.getItem('token');
    const container = document.getElementById('saved-container');
    if (!container) return;

    if (!token || !userId) {
        container.innerHTML = buildEmptyState('Not signed in', 'Please log in to view your saved resumes.');
        return;
    }

    container.innerHTML = buildSkeletonLoader(2);

    try {
        // Try the primary endpoint first
       let res = await fetch(`https://cvoice-1.onrender.com/api/resume/user/${userId}`, {
            credentials: 'include'
        });

        // Fallback to query-param style endpoint
        if (!res.ok) {
          res = await fetch(`https://cvoice-1.onrender.com/api/resume?userId=${userId}`, {
               credentials: 'include'
           });
        }

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const payload = await res.json();

        // Normalise to array regardless of response shape
        const resumes = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload.data) ? payload.data : []);

        container.innerHTML = '';

        if (resumes.length === 0) {
            container.innerHTML = buildEmptyState(
                'No saved resumes yet',
                'Create one from the Templates tab and save it from the editor.'
            );
            return;
        }

        resumes.forEach((resume, i) => {
            const tpl  = document.getElementById('saved-tpl').content.cloneNode(true);
            const card = tpl.querySelector('.saved-card');

            card.id = `resume-card-${resume._id}`;
            card.style.animationDelay = `${i * 0.08}s`;

            // Name
            tpl.querySelector('.js-title').textContent =
                resume.personalInfo?.name || 'Untitled Resume';

            // Template type label
            const tplType = resume.templateType
                || resume.templateSpecificInputs?.templateType
                || 'standard';
            const metaEl = tpl.querySelector('.js-meta');
            if (metaEl) {
                metaEl.textContent = (TEMPLATE_DISPLAY_NAMES[tplType] || tplType);
            }

            // Date
            const d = new Date(resume.updatedAt || resume.createdAt);
            tpl.querySelector('.js-date').textContent =
                'Updated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            // Smart routing
            const isCustom = tplType === 'custom' || resume.templateSpecificInputs?.isCustom;
            tpl.querySelector('.js-open').onclick = () => {
                window.location.href = isCustom
                    ? `customize.html?id=${resume._id}`
                    : `editor.html?id=${resume._id}`;
            };

            // Delete
            tpl.querySelector('.js-del').onclick = (e) => {
                e.stopPropagation();
                deleteResume(resume._id);
            };

            container.appendChild(tpl);
        });

    } catch (err) {
        console.error('fetchSavedResumes error:', err);
        container.innerHTML = '<p class="error-state">Connection error — is your server running?</p>';
    }
}

/**
 * Delete a resume by ID, then remove its card from the DOM.
 */
async function deleteResume(id) {
    if (!confirm('Delete this resume? This cannot be undone.')) return;

    try {
       const res = await fetch(`https://cvoice-1.onrender.com/api/resume/${id}`, { 
            method: 'DELETE',
            credentials: 'include'
        });

        if (res.ok) {
            const card = document.getElementById(`resume-card-${id}`);
            if (card) card.remove();

            // Show empty state if no cards remain
            const container = document.getElementById('saved-container');
            if (container && container.querySelectorAll('.saved-card').length === 0) {
                container.innerHTML = buildEmptyState(
                    'No saved resumes yet',
                    'Create one from the Templates tab and save it from the editor.'
                );
            }
        } else {
            alert('Failed to delete resume. Please try again.');
        }
    } catch (err) {
        console.error('deleteResume error:', err);
        alert('Error connecting to server.');
    }
}

/**
 * Build the empty-state HTML block.
 */
function buildEmptyState(title, sub) {
    return `
        <div class="empty-state">
            <div class="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>
            <div class="empty-title">${title}</div>
            <div class="empty-sub">${sub}</div>
        </div>`;
}