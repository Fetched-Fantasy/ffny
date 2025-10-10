 document.getElementById('webhook-button').addEventListener('click', function() {
 const webhookUrl = document.getElementById('webhook-url').value;
 const message = document.getElementById('webhook-message').value;
 const title = document.getElementById('webhook-title').value;
 const imageUrl = document.getElementById('webhook-image-url').value;
 const authorName = document.getElementById('webhook-author').value;


 const data = {
 embeds: [{
 title: title,
 description: message,
 color: 8388608, // Purple color code
 author: {
 name: authorName
 },
 image: {
 url: imageUrl
 }
 }]
 };

 fetch(webhookUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(data)
 })
 .then(response => {
 if (response.ok) {
 alert('Message sent successfully!');
 } else {
 alert('Failed to send message.');
 }
 })
 .catch(error => {
 console.error('Error:', error);
 alert('An error occurred while sending the message.');
 });
 });