// Function to show the toast notification
function showToast(message) {
    const toast = document.getElementById('offlineToast');
    const toastMessage = document.getElementById('offlineToastMessage');
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    // Hide the toast after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
    }, 5000);
}

// Check online/offline status
window.addEventListener('online', () => {
    showToast('You are back online');
});

window.addEventListener('offline', () => {
    showToast('You are offline');
});

// Initial check
if (!navigator.onLine) {
    showToast('You are offline');
}