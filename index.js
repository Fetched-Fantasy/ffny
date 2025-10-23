document.addEventListener('DOMContentLoaded', function() {

  const changeLogList = document.getElementById('change-log-list');

  // Function to format the date as MM-DD-YYYY
  function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}-${year}`;
  }

  // Function to display changelog entries
  function displayChangelog(data) {
    changeLogList.innerHTML = ''; // Clear existing entries
    data.forEach(entry => {
      const li = document.createElement('li');
      const formattedDate = formatDate(entry.date);
      li.textContent = `[${formattedDate}] - ${entry.description}`;
      changeLogList.appendChild(li);
    });
  }

  // Load changelog data
  function loadChangelog() {
    fetch('changelog.json')
      .then(response => response.json())
      .then(data => {
        console.log("Changelog data:", data);
        displayChangelog(data);
      })
      .catch(error => {
        console.error('Error fetching changelog data:', error);
        changeLogList.innerHTML = `<p>Failed to load change log: ${error.message}</p>`;
      });
  }

  // Load changelog data initially
  loadChangelog();
});
