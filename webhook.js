 document.getElementById('webhook-button').addEventListener('click', function() {
 // Get all of the things to get for all of the elements
 const webhookUrl = document.getElementById('webhook-url').value;
 const messageId = document.getElementById('message-id').value;
 const message = document.getElementById('webhook-message').value;
 const title = document.getElementById('webhook-title').value;
 const imageUrl = document.getElementById('webhook-image-url').value;
 const authorName = document.getElementById('webhook-author').value;
 const color = document.getElementById('webhook-color').value;
 const colorInt = parseInt(color.slice(1), 16);
 // Construct the data to post on discord
 const data = {
 embeds: [{
 title: title,
 description: message,
 color: colorInt, // Purple color code
 author: {
 name: authorName
 },
 image: {
 url: imageUrl
 }
 }]
 };
 // Construct it such that if there is a message, to edit it
 const editMessageUrl = `${webhookUrl}/messages/${messageId}`;

 fetch(editMessageUrl, {
 method: 'PATCH',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ embeds: data.embeds })
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

 function escapeHTML(str) {
 let p = document.createElement('p');
 p.textContent = str;
 return p.innerHTML;
 }
function generateCode() {
 // Generate all of the variables, and make sure to take that information
 const webhookUrl = document.getElementById('webhook-url').value;
 const messageId = document.getElementById('message-id').value;
 const message = document.getElementById('webhook-message').value;
 const title = document.getElementById('webhook-title').value;
 const imageUrl = document.getElementById('webhook-image-url').value;
 const authorName = document.getElementById('webhook-author').value;
 const color = document.getElementById('webhook-color').value;
 const colorInt = parseInt(color.slice(1), 16);
 // Construct the data to post on discord
let code = `
const webhookUrl = "${escapeHTML(webhookUrl)}";
const data = {
 "embeds": [{
 "title": "${escapeHTML(title)}",
 "description": "${escapeHTML(message)}",
 "color": ${colorInt},
 "author": {
 "name": "${escapeHTML(authorName)}"
 },
 "image": {
 "url": "${escapeHTML(imageUrl)}"
 }
 }]
};

fetch(webhookUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(data)
});`
 //log it to the text box
document.getElementById('code-output').value = code;
hljs.highlightAll();
}

//add functions
document.getElementById('webhook-button').addEventListener('click', generateCode);
