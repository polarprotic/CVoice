document.addEventListener("DOMContentLoaded", async () => {
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("token");
  const container = document.getElementById("saved-resumes-container");

  // 1. Security Check
  if (!token || !userId) {
    window.location.href = "/auth.html";
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/resume?userId=${userId}`);
    
    if (!response.ok) {
        throw new Error("Network response was not ok");
    }
    
    const resumes = await response.json();

    // Clear the "loading" text
    container.innerHTML = "";

    if (resumes.length === 0) {
      container.innerHTML = '<p style="color: #64748b;">You haven\'t created any resumes yet. Start by picking a template above!</p>';
      return;
    }

    // --- ADDED 'custom' TO THE DICTIONARY ---
    const templateNames = {
        'academic': 'Technical Executive',
        'minimal': 'Sleek Minimalist',
        'modern': 'Contemporary Creative',
        'attorney': 'Traditional Corporate',
        'custom': 'Customised Layout' // 🚨 This is your new category!
    };

    // Create a card for each saved resume
    resumes.forEach((resume, index) => {
      const card = document.createElement('div');
      card.className = 'saved-card stagger';
      card.style.animationDelay = `${(index * 0.1) + 0.9}s`;
      
      // Give the card a specific ID so we can find it later to delete it
      card.id = `resume-card-${resume._id}`;

      // Use the dictionary to get the pretty name!
      const displayName = templateNames[resume.templateType] || resume.templateType || 'Standard';

      // 🚨 DYNAMIC ROUTING LOGIC 🚨
      // If it's a custom template, route to Solaris Studio. Otherwise, route to standard Editor.
      const targetUrl = resume.templateType === 'custom' ? '/customize.html' : '/editor.html';

      card.innerHTML = `
        <div class="delete-btn" onclick="deleteResume('${resume._id}')">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </div>

        <div class="resume-icon-badge">
            <svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </div>

        <div class="card-title">${resume.personalInfo?.name || 'Untitled Resume'}</div>
        <div style="color: var(--primary); font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
            ${displayName} Engine
        </div>
        <div style="color: var(--text-dim); font-size: 0.8rem; margin-top: 8px;">
            Sync Date: ${new Date(resume.updatedAt).toLocaleDateString()}
        </div>

        <button class="btn-workspace" onclick="window.location.href='${targetUrl}?id=${resume._id}'">
            Open Workspace
        </button>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    container.innerHTML = '<p style="color: #ef4444;">Error loading resumes. Please ensure your backend is running.</p>';
  }
});

async function deleteResume(id) {
  if (!confirm("Do you want to delete it?")) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/resume/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      // Find the exact card on the screen and remove it instantly
      const cardToRemove = document.getElementById(`resume-card-${id}`);
      if (cardToRemove) {
          cardToRemove.remove();
      }

      // If that was the last resume, show the empty message
      const container = document.getElementById("saved-resumes-container");
      if (container.children.length === 0) {
          container.innerHTML = '<p style="color: #64748b;">You haven\'t created any resumes yet. Start by picking a template above!</p>';
      }

    } else {
      alert("❌ Failed to delete resume.");
    }
  } catch (error) {
    console.error("Delete error:", error);
    alert("Error connecting to server.");
  }
}