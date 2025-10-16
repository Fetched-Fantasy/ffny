// server.js

const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

const port = 3000;

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  if (url === '/admin' && method === 'GET') {
    // Serve admin.html
    fs.readFile(path.join(__dirname, 'admin.html'), (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading admin.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    });
  } else if (url === '/update-changelog' && method === 'POST') {
    // Handle changelog updates
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const parsedBody = querystring.parse(body);
      const newChangelogContent = parsedBody.changelogContent;

      fs.writeFile('CHANGELOG.md', newChangelogContent, (err) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error updating changelog');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Changelog updated successfully!');
      });
    });
  } else {
    // Handle 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});