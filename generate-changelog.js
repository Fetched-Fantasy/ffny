// generate-changelog.js

const conventionalChangelog = require('conventional-changelog');
const fs = require('fs');
const path = require('path');

async function generateChangelog() {
  try {
    const changelogStream = conventionalChangelog(
      {
        config: require('./changelog.config.js')
      }
    );

    const changelogPath = 'CHANGELOG.md';
    const indexHtmlPath = 'index.html';

    const outputStream = fs.createWriteStream(changelogPath);

    changelogStream.pipe(outputStream);

    outputStream.on('finish', () => {
      // Read the generated changelog
      fs.readFile(changelogPath, 'utf8', (err, changelogContent) => {
        if (err) {
          console.error('Error reading CHANGELOG.md:', err);
          return;
        }

        // Read the index.html file
        fs.readFile(indexHtmlPath, 'utf8', (err, indexHtmlContent) => {
          if (err) {
            console.error('Error reading index.html:', err);
            return;
          }

          // Inject the changelog content into index.html
          const updatedIndexHtml = indexHtmlContent.replace(
            /<div id="changelog"><\/div>/,
            `<div id="changelog">${changelogContent}</div>`
          );

          // Write the updated index.html back to the file
          fs.writeFile(indexHtmlPath, updatedIndexHtml, 'utf8', (err) => {
            if (err) {
              console.error('Error writing to index.html:', err);
              return;
            }

            console.log('Changelog generated and index.html updated successfully!');
          });
        });
      });
    });
  } catch (error) {
    console.error('Error generating changelog:', error);
  }
}

generateChangelog();