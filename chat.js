document.addEventListener('DOMContentLoaded', function() {
  const sendButton = document.getElementById('send-button');
  const messageInput = document.getElementById('message-input');
  const chatDisplay = document.getElementById('chat-display');

  // --- REPLACE MOCK SOCKET WITH ABLY ---
  const ably = new Ably.Realtime('XRHh7Q.AYC1KA:pl1HM7BjoJeiHQh1xF2kSShs5Tfy1OKjb1spOnQIQKQ'); // Replace with your Ably API Key
  const channel = ably.channels.get('ffny-chat'); // Channel name

  // Subscribe to the channel
  channel.subscribe('message', function (msg) {
    const messageElement = document.createElement('div');
    messageElement.textContent = msg.data.text;
    chatDisplay.appendChild(messageElement);
  });
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
});