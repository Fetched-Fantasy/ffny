// pages/api/changelog.js

import fs from 'fs/promises';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const changelogContent = await fs.readFile('CHANGELOG.md', 'utf8');
      res.status(200).json({ content: changelogContent });
    } catch (error) {
      console.error('Error reading CHANGELOG.md:', error);
      res.status(500).json({ error: 'Failed to read changelog.' });
    }
  } else if (req.method === 'POST') {
    const { content } = req.body;
    try {
      await fs.writeFile('CHANGELOG.md', content);
      res.status(200).json({ message: 'Changelog updated successfully.' });
    } catch (error) {
      console.error('Error writing to CHANGELOG.md:', error);
      res.status(500).json({ error: 'Failed to update changelog.' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed.' });
  }
}