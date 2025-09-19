// Get the modal
function openProfileModal(profile) {
 var modal = document.getElementById(profile+'Modal');
 modal.style.display = "block";
}
// When the user clicks on <span> (x), close the modal
function closeProfileModal(profile) {
 var modal = document.getElementById(profile+'Modal');
 modal.style.display = "none";
}
 async function loadProfiles() {
 try {
 const response = await fetch('profiles.json');
 const profiles = await response.json();
 displayProfiles(profiles);
 } catch (error) {
 console.error('Error fetching profiles:', error);
 document.getElementById('profile-container').innerHTML = '<p>Failed to load profiles.</p>';
 }
 }

 function displayProfiles(profiles) {
 const container = document.getElementById('profile-container');
 container.innerHTML = ''; // Clear existing content

 profiles.forEach(profile => {
 const profileSquare = document.createElement('div');
 profileSquare.classList.add('profile-square');
 profileSquare.onclick = () => openProfileModal(profile.id);

 const img = document.createElement('img');
 img.src = profile.image;
 img.alt = 'Profile Picture';
 img.classList.add('profile-image');

 const username = document.createElement('h3');
 username.classList.add('profile-username');
 username.textContent = profile.username;

 const role = document.createElement('p');
 role.classList.add('profile-role');
 role.textContent = profile.role;

 profileSquare.appendChild(img);
 profileSquare.appendChild(username);
 profileSquare.appendChild(role);

 // Create Modal
 const profileModal = document.createElement('div');
 profileModal.id = profile.id + 'Modal';
 profileModal.classList.add('profile-modal');

 const modalContent = document.createElement('div');
 modalContent.classList.add('profile-modal-content');

 const closeButton = document.createElement('span');
 closeButton.classList.add('close');
 closeButton.textContent = '×';
 closeButton.onclick = () => closeProfileModal(profile.id);

 const modalLeft = document.createElement('div');
 modalLeft.classList.add('modal-left');

 const modalImg = document.createElement('img');
 modalImg.src = profile.image;
 modalImg.alt = 'Profile Picture';
 modalImg.classList.add('profile-image', 'modal-profile-image');

 const modalUsername = document.createElement('h3');
 modalUsername.textContent = profile.username;

 const modalDescription = document.createElement('p');
 modalDescription.textContent = profile.description;

 modalLeft.appendChild(modalImg);
 modalLeft.appendChild(modalUsername);
 modalLeft.appendChild(modalDescription);

 const modalRight = document.createElement('div');
 modalRight.classList.add('modal-right');

 const rank = document.createElement('p');
 rank.innerHTML = `<strong>Rank:</strong> ${profile.rank}`;

 const department = document.createElement('p');
 department.innerHTML = `<strong>Department:</strong> ${profile.department}`;

 const job = document.createElement('p');
 job.innerHTML = `<strong>Job:</strong> ${profile.job}`;

 modalRight.appendChild(rank);
 modalRight.appendChild(department);
 modalRight.appendChild(job);

 modalContent.appendChild(closeButton);
 modalContent.appendChild(modalLeft);
 modalContent.appendChild(modalRight);
 profileModal.appendChild(modalContent);


 container.appendChild(profileSquare);
 container.appendChild(profileModal);
 });
 }

 window.addEventListener('load', loadProfiles);