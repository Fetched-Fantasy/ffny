const chatDisplay = document.getElementById('chat-display');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

const ws = new WebSocket('ffny.fetched.workers.dev'); // Replace with your server URL

ws.addEventListener('open', () => {
  console.log('Connected to WebSocket server');
});

ws.addEventListener('message', event => {
  const data = JSON.parse(event.data);

  if (data.type === 'history') {
    data.messages.forEach(msg => {
      appendMessage(msg.content);
    });
  } else if (data.type === 'new') {
    appendMessage(data.message);
  }
  chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to bottom
});

ws.addEventListener('error', error => {
  console.error('WebSocket error:', error);
  appendMessage("Error connecting to chat server.");
});

ws.addEventListener('close', () => {
  console.log('Disconnected from WebSocket server');
  appendMessage("Disconnected from chat server.");
});

sendButton.addEventListener('click', () => {
  const message = messageInput.value;
  ws.send(message);
  messageInput.value = '';
});

messageInput.addEventListener('keyup', (event) => {
    if (event.key === "Enter") {
        sendButton.click();
    }
});

function appendMessage(message) {
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  chatDisplay.appendChild(messageElement);
  chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to bottom
}