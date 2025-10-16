// Define role priority (lower number = higher priority)
const rolePriority = {
  "The Fox": 1,
  "Chief": 2,
  "Chief Verients": 2,
  "Supervisors": 3,
  "Sergeants": 4,
  "Officers": 5,
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

const toggleBtn = document.getElementById("toggleProfiles");
const profilesWrapper = document.getElementById("profilesWrapper");

// Start collapsed
profilesWrapper.classList.remove("open");
toggleBtn.textContent = "Show Profiles";

toggleBtn.addEventListener("click", () => {
  if (profilesWrapper.classList.contains("open")) {
    profilesWrapper.classList.remove("open");
    toggleBtn.textContent = "Show Profiles";
  } else {
    profilesWrapper.classList.add("open");
    toggleBtn.textContent = "Hide Profiles";
  }
});

// ADDED CODE
const hamburger = document.querySelector(".hamburger");
const navContainer = document.querySelector(".nav-container");

hamburger.addEventListener('click', () => {
 navContainer.classList.toggle('nav-active');
});

// index.js

// GitHub raw URL for the changelog.json file
// index.js

// GitHub raw URL for the changelog.json file
const changelogUrl = 'https://raw.githubusercontent.com/Fetched-Fantasy/ffny/main/changelog.json'; // Replace with your actual URL
const changeLogList = document.getElementById('change-log-list');

// Function to format the date as YYYY-MM-DD
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Fetch the changelog data from the raw GitHub URL
fetch(changelogUrl)
 .then(response => response.json())
 .then(data => {
 // Iterate over the data and generate the list items
 data.forEach(entry => {
 const li = document.createElement('li');
 // Format the date using the formatDate function
 const formattedDate = formatDate(entry.date);
 li.textContent = `[${formattedDate} - ${entry.description}`;
 changeLogList.appendChild(li);
 });
 })
 .catch(error => {
 console.error('Error fetching changelog data:', error);
 changeLogList.innerHTML = '<p>Failed to load change log.</p>';
 });
const changeLogList = document.getElementById('change-log-list');

// Function to format the date as MM-DD-YYYY
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${year}`;
}

// Fetch the changelog data from the raw GitHub URL
fetch(changelogUrl)
 .then(response => {
  console.log("Changelog response:", response);
  return response.json();
})
 .then(data => {
  console.log("Changelog data:", data);
 // Iterate over the data and generate the list items
 data.forEach(entry => {
  console.log("Changelog entry:", entry);
 const li = document.createElement('li');
 // Format the date using the formatDate function
 const formattedDate = formatDate(entry.date);
 li.textContent = `[${formattedDate}] - ${entry.description}`;
 changeLogList.appendChild(li);
 });
 })
 .catch(error => {
 console.error('Error fetching changelog data:', error);
 changeLogList.innerHTML = '<p>Failed to load change log.</p>';
 });

