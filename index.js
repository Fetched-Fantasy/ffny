const navContainer = document.querySelector(".nav-container");

hamburger.addEventListener('click', () => {
 navContainer.classList.toggle('nav-active');
});

// index.js

const changeLogList = document.getElementById('change-log-list');

// Function to format the date as MM-DD-YYYY
function formatDate(dateString) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}-${year}`;
}

// Fetch the changelog data from changelog.json
fetch('changelog.json')
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
    changeLogList.innerHTML = `<p>Failed to load change log: ${error.message}</p>`; // Added error message
  });

document.addEventListener('DOMContentLoaded', function() {
  // Initialize CacheP2P
  const cacheP2P = new CacheP2P();

  // Start CacheP2P
  cacheP2P.start({
    assets: ['changelog.json']
  });
});

