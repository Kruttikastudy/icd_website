document.getElementById("searchBtn").addEventListener("click", searchICD);

async function searchICD() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");

  if (!query) {
    resultsDiv.innerHTML = "<p>Please enter an ICD code.</p>";
    return;
  }

  resultsDiv.innerHTML = "<p>Searching...</p>";

  try {
    const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.length === 0) {
      resultsDiv.innerHTML = "<p>No exact match found.</p>";
      return;
    }

    const row = data[0];
    resultsDiv.innerHTML = "";

    // Condition + Billability + Years
    const conditionBox = document.createElement("div");
    conditionBox.className = "box";
    conditionBox.innerHTML = `
      <h2>${row.icd_10_code}: ${row.original_condition}</h2>
      <div class="billable-box">Billability: ${row.billability}</div>
      ${row.years ? `<p><strong>Years of Billability:</strong> ${row.years}</p>` : ""}
    `;
    resultsDiv.appendChild(conditionBox);

    // Synonyms & Drugs side-by-side
    if (row.synonyms || row.drugs) {
      const flexContainer = document.createElement("div");
      flexContainer.className = "flex-container";

      if (row.synonyms) {
        const synonymsBox = document.createElement("div");
        synonymsBox.className = "box flex-item";
        synonymsBox.innerHTML = "<h3>Synonyms</h3>";
        const ul = document.createElement("ul");
        row.synonyms.split(";").forEach(syn => {
          const li = document.createElement("li");
          li.textContent = syn.trim();
          ul.appendChild(li);
        });
        synonymsBox.appendChild(ul);
        flexContainer.appendChild(synonymsBox);
      }

      if (row.drugs) {
        const drugsBox = document.createElement("div");
        drugsBox.className = "box flex-item";
        drugsBox.innerHTML = "<h3>Drugs</h3>";
        const ul = document.createElement("ul");
        row.drugs.split(";").forEach(drug => {
          const li = document.createElement("li");
          li.textContent = drug.trim();
          ul.appendChild(li);
        });
        drugsBox.appendChild(ul);
        flexContainer.appendChild(drugsBox);
      }

      resultsDiv.appendChild(flexContainer);
    }

  } catch (error) {
    resultsDiv.innerHTML = "<p>Error fetching data.</p>";
    console.error(error);
  }
}
