// Utility for notifications
function showNotification(message, type = 'success') {
  const note = document.getElementById('notification');
  note.textContent = message;
  note.className = type === 'success' ? 'bg-success' : 'bg-error';
  note.style.display = 'block';
  setTimeout(() => { note.style.display = 'none'; }, 3000);
}

// Check user status to show/hide links
async function checkStatus() {
  try {
    const res = await fetch('/api/user-status');
    const data = await res.json();
    const navLinks = document.getElementById('navLinks');

    if (data.loggedIn) {
      navLinks.innerHTML = `
        <a href="index.html" class="active">Search</a>
        <a href="editor.html">Editor</a>
        <a href="#" id="logoutBtn" class="btn-nav">Logout (${data.user.username})</a>
      `;
      document.getElementById('logoutBtn').addEventListener('click', logout);
    } else {
      navLinks.innerHTML = `
        <a href="index.html" class="active">Search</a>
        <a href="signin.html" class="btn-nav">Sign In</a>
      `;
    }
  } catch (err) {
    console.error("Status check failed", err);
  }
}

async function logout(e) {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.reload();
}

// Search Functionality
document.getElementById("searchBtn").addEventListener("click", searchICD);
document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === 'Enter') searchICD();
});

async function searchICD() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");

  if (!query) {
    showNotification("Please enter an ICD code or condition", "error");
    return;
  }

  resultsDiv.innerHTML = '<div class="card" style="text-align:center;">Searching...</div>';

  try {
    const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.length === 0) {
      resultsDiv.innerHTML = '<div class="card" style="text-align:center;">No match found.</div>';
      return;
    }

    resultsDiv.innerHTML = "";

    // Using the 'old layout' logic with new aesthetics
    const row = data[0];

    // Main Card: Condition + Billability
    const conditionBox = document.createElement("div");
    conditionBox.className = "card";
    conditionBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
        <div style="flex: 1;">
          <span class="tag">${row.icd_10_code}</span>
          <h2 style="margin: 0.5rem 0; font-size: 1.8rem;">${row.original_condition}</h2>
          ${row.years ? `<p style="margin: 0.5rem 0;"><strong>Years of Billability:</strong> ${row.years}</p>` : ""}
        </div>
        <div class="billable-box">Billability: ${row.billability}</div>
      </div>
    `;
    resultsDiv.appendChild(conditionBox);

    // Dynamic Columns Box
    const extraFields = Object.keys(row).filter(key =>
      !['icd_10_code', 'original_condition', 'billability', 'years', 'synonyms', 'drugs'].includes(key) && row[key]
    );

    if (extraFields.length > 0) {
      const extraBox = document.createElement("div");
      extraBox.className = "card";
      extraBox.innerHTML = extraFields.map(key => `
        <p style="margin: 0.4rem 0;"><strong>${key.replace(/_/g, ' ')}:</strong> ${row[key]}</p>
      `).join('');
      resultsDiv.appendChild(extraBox);
    }

    // Synonyms & Drugs side-by-side
    if (row.synonyms || row.drugs) {
      const flexContainer = document.createElement("div");
      flexContainer.className = "flex-container";

      if (row.synonyms) {
        const synonymsBox = document.createElement("div");
        synonymsBox.className = "card flex-item";
        synonymsBox.innerHTML = `
          <h3 style="margin-top: 0; color: var(--primary); border-bottom: 2px solid var(--accent); padding-bottom: 0.5rem; margin-bottom: 1rem;">Synonyms</h3>
          <ul style="list-style-type: none; padding: 0;">
            ${row.synonyms.split(';').map(s => `<li style="margin-bottom: 0.5rem; padding-left: 1.2rem; position: relative;"><span style="position: absolute; left: 0; color: var(--primary);">•</span>${s.trim()}</li>`).join('')}
          </ul>
        `;
        flexContainer.appendChild(synonymsBox);
      }

      if (row.drugs) {
        const drugsBox = document.createElement("div");
        drugsBox.className = "card flex-item";
        drugsBox.innerHTML = `
          <h3 style="margin-top: 0; color: var(--success); border-bottom: 2px solid #e9f5f3; padding-bottom: 0.5rem; margin-bottom: 1rem;">Drugs</h3>
          <ul style="list-style-type: none; padding: 0;">
            ${row.drugs.split(';').map(d => `<li style="margin-bottom: 0.5rem; padding-left: 1.2rem; position: relative;"><span style="position: absolute; left: 0; color: var(--success);">•</span>${d.trim()}</li>`).join('')}
          </ul>
        `;
        flexContainer.appendChild(drugsBox);
      }

      resultsDiv.appendChild(flexContainer);
    }

  } catch (error) {
    showNotification("Error fetching data", "error");
    console.error(error);
  }
}

checkStatus();
