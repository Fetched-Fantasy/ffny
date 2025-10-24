document.addEventListener('DOMContentLoaded', function() {
  const sendButton = document.getElementById('send-button');
  const messageInput = document.getElementById('message-input');
  const chatDisplay = document.getElementById('chat-display');
  // --- REPLACE MOCK SOCKET WITH ABLY ---
  const ably = new Ably.Realtime('YOUR_ABLY_API_KEY'); // Replace with your Ably API Key
  const channel = ably.channels.get('ffny-chat'); // Channel name

    // Function to load messages from local storage
    function loadMessages() {
        const storedMessages = localStorage.getItem('chatMessages');
        if (storedMessages) {
            const messages = JSON.parse(storedMessages);
            messages.forEach(message => {
                displayMessage(message);
            });
        }
    }
    // Function to display a message in the chat window
    function displayMessage(message) {
      const messageElement = document.createElement('div');
      messageElement.textContent = message.text;
      chatDisplay.appendChild(messageElement);
    }

  // Subscribe to the channel
  channel.subscribe('message', function (msg) {
      // Extract data from the message
      const messageText = msg.data.text;
       // Create a new message object
      const message = { text: messageText };

       // Display the new message
        displayMessage(message);

        // Save the message to local storage
      saveMessage(message);
   
  });
// Function to save a message to local storage
    function saveMessage(message) {
        let messages = JSON.parse(localStorage.getItem('chatMessages') || '[]');
        messages.push(message);
        localStorage.setItem('chatMessages', JSON.stringify(messages));
    }
  // -------------------------------------

  sendButton.addEventListener('click', function() {
    const message = messageInput.value;
    if (message) {
      // --- PUBLISH TO ABLY INSTEAD OF EMITTING ---
      channel.publish('message', { text: message });
      // -------------------------------------------
      messageInput.value = ''; // Clear the input
    }
  });
   // Load initial messages
    loadMessages();
});