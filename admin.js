// admin.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (like admin.html)
app.use(express.static(path.join(__dirname)));

// Route to display the admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Route to handle changelog updates
app.post('/update-changelog', (req, res) => {
  const newChangelogContent = req.body.changelogContent;

  fs.writeFile('CHANGELOG.md', newChangelogContent, (err) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error updating changelog.');
      return;
    }

    res.send('Changelog updated successfully!');
  });
});

app.listen(port, () => {
  console.log(`Admin panel listening at http://localhost:${port}`);
});