document.addEventListener('DOMContentLoaded', function() {
  const sendButton = document.getElementById('send-button');
  const messageInput = document.getElementById('message-input');
  const chatDisplay = document.getElementById('chat-display');

  // Mock Socket.IO client-side
  const socket = {
    emit: function(event, data) {
      // In a real implementation, this would send the data to the server
      console.log(`Emitting ${event} with data:`, data);

      // Mock receiving the message (for demonstration purposes)
      const messageElement = document.createElement('div');
      messageElement.textContent = data.message;
      chatDisplay.appendChild(messageElement);
    }
  };

  sendButton.addEventListener('click', function() {
    const message = messageInput.value;
    if (message) {
      socket.emit('chat message', { message: message });
      messageInput.value = ''; // Clear the input
    }
  });
});