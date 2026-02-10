function toggleBox(id) {
    const box = document.getElementById(id);
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

let currentPage = 1;
let columns = [];

function showNotification(message, type = 'success') {
    const note = document.getElementById('notification');
    note.textContent = message;
    note.className = type === 'success' ? 'bg-success' : 'bg-error';
    note.style.display = 'block';
    setTimeout(() => { note.style.display = 'none'; }, 3000);
}

async function checkAuth() {
    const res = await fetch('/api/user-status');
    const data = await res.json();
    if (!data.loggedIn) {
        window.location.href = 'signin.html';
    }
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = 'index.html';
    });
}

async function loadTable() {
    const search = document.getElementById('editorSearchInput')?.value.trim() || "";
    try {
        // Load columns
        const colRes = await fetch('/api/table-columns');
        columns = await colRes.json();

        const headRow = document.getElementById('tableHead');
        headRow.innerHTML = columns.map(col => `<th>${col.column_name}</th>`).join('') + '<th>Actions</th>';

        renderNewRowForm();

        // Load data with search param
        const dataRes = await fetch(`/api/all-codes?page=${currentPage}&search=${encodeURIComponent(search)}`);
        const data = await dataRes.json();

        const body = document.getElementById('tableBody');
        if (data.length === 0) {
            body.innerHTML = `<tr><td colspan="${columns.length + 1}" style="text-align:center; padding: 2rem; color: var(--text-light);">No matching records found. Try a different search term.</td></tr>`;
        } else {
            body.innerHTML = data.map(row => `
              <tr>
                ${columns.map(col => {
                const isKey = col.column_name === 'icd_10_code';
                return `<td ${isKey ? '' : `contenteditable="true" onblur="updateCell('${row.icd_10_code}', '${col.column_name}', this.textContent)"`}>
                    ${row[col.column_name] || ''}
                  </td>`;
            }).join('')}
                <td style="text-align: center;">
                    <button class="btn-search" style="background: var(--error); padding: 5px 12px; font-size: 0.8rem; border-radius: 4px;" onclick="deleteRow('${row.icd_10_code}')">Delete</button>
                </td>
              </tr>
            `).join('');
        }

        document.getElementById('pageInfo').textContent = search ? `Filtered: "${search}"` : `Page ${currentPage}`;
    } catch (err) {
        console.error(err);
        showNotification('Failed to load data', 'error');
    }
}

async function deleteRow(id) {
    if (!confirm(`Are you sure you want to delete record ${id}? This action will be logged.`)) return;

    try {
        const res = await fetch('/api/delete-row', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        if (res.ok) {
            showNotification('Record deleted successfully');
            loadTable();
        } else {
            const data = await res.json();
            showNotification(data.error || 'Delete failed', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
}

function searchEditor() {
    currentPage = 1; // Reset to page 1 on new search
    loadTable();
}

// Add Enter key support for search
document.getElementById('editorSearchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchEditor();
});

function renderNewRowForm() {
    const container = document.getElementById('dynamicInputs');
    if (!container) return;

    // Filter out 'id' column as it will be auto-calculated on the server
    const visibleColumns = columns.filter(col => col.column_name !== 'id');

    container.innerHTML = visibleColumns.map(col => `
        <div class="form-group" style="margin-bottom: 0.8rem;">
            <label style="font-size: 0.85rem; color: var(--text-light);">${col.column_name.replace(/_/g, ' ')}</label>
            <input type="text" id="new_row_${col.column_name}" placeholder="Enter ${col.column_name}">
        </div>
    `).join('');
}

async function addRow() {
    const rowData = {};
    columns.forEach(col => {
        const input = document.getElementById(`new_row_${col.column_name}`);
        if (input && input.value) {
            rowData[col.column_name] = input.value;
        }
    });

    if (!rowData.icd_10_code) {
        showNotification('ICD-10 Code is required', 'error');
        return;
    }

    try {
        const res = await fetch('/api/add-row', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rowData)
        });
        if (res.ok) {
            showNotification('Row added and logged');
            // Clear inputs and hide
            columns.forEach(col => {
                const input = document.getElementById(`new_row_${col.column_name}`);
                if (input) input.value = '';
            });
            toggleBox('addRowBox');
            loadTable(); // Refresh
        } else {
            const data = await res.json();
            showNotification(data.error || 'Failed to add row', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
}

async function updateCell(id, columnName, newValue) {
    try {
        const res = await fetch('/api/update-cell', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, columnName, newValue: newValue.trim() })
        });
        if (res.ok) {
            showNotification('Cell updated and logged');
        } else {
            const data = await res.json();
            showNotification(data.error || 'Update failed', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
}

async function addColumn() {
    const columnName = document.getElementById('newColName').value.trim();
    const dataType = document.getElementById('newColType').value.trim() || 'TEXT';

    if (!columnName) {
        showNotification('Please enter a column name', 'error');
        return;
    }

    try {
        const res = await fetch('/api/add-column', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ columnName, dataType })
        });
        if (res.ok) {
            showNotification('Column added successfully');
            document.getElementById('newColName').value = '';
            toggleBox('addFieldBox');
            loadTable(); // Refresh
        } else {
            const data = await res.json();
            showNotification(data.error || 'Failed to add column', 'error');
        }
    } catch (err) {
        showNotification('Network error', 'error');
    }
}

document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        loadTable();
    }
});

document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    loadTable();
});

checkAuth().then(loadTable);

// Mobile Menu Toggle
document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
    document.getElementById('menuToggle').classList.toggle('open');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('navLinks');
    const toggle = document.getElementById('menuToggle');
    if (menu.classList.contains('active') && !menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove('active');
        toggle.classList.remove('open');
    }
});
