// Define role priority (lower number = higher priority)
const rolePriority = {
  "Founder/Creator": 1,
  "Founder": 1,
  "Co-Owner": 2,
  "Owner": 2,
  "Lead": 3,
  "Manager": 4,
  "Staff": 5,
  "Member": 6
};

// Load profiles from external JSON
fetch("profiles.json")
  .then(response => response.json())
  .then(profiles => {
    // Sort profiles by role priority, then by name
    profiles.sort((a, b) => {
      const aPriority = rolePriority[a.role] || 99;
      const bPriority = rolePriority[b.role] || 99;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.name.localeCompare(b.name);
    });

    const container = document.getElementById("profileContainer");
    profiles.forEach(profile => {
      const div = document.createElement("div");
      div.className = "profile-square";
      div.innerHTML = `
        <img src="${profile.img}" alt="${profile.name}">
        <p>${profile.name}</p>
      `;
      div.onclick = () => openProfileModal(profile);
      container.appendChild(div);
    });
  })
  .catch(err => console.error("Error loading profiles:", err));

// Modal functions
function openProfileModal(profile) {
  document.getElementById("modalName").textContent = profile.name;
  document.getElementById("modalRole").textContent = profile.role;
  document.getElementById("modalDept").textContent = profile.dept;
  document.getElementById("modalJob").textContent = profile.job;
  document.getElementById("modalImage").src = profile.img;
  document.getElementById("modalDescription").textContent = profile.description;
  document.getElementById("profileModal").style.display = "block";
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

// Close modal when clicking outside
window.onclick = function(event) {
  const modal = document.getElementById("profileModal");
  if (event.target == modal) {
    modal.style.display = "none";
  }
};
