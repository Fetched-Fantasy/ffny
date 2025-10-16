// pages/admin/changelog.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ChangelogAdmin() {
  const [changelogContent, setChangelogContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  // ** IMPORTANT: Add proper authentication here (e.g., NextAuth.js) **
  const isAdmin = router.query.token === 'adminToken'; // Replace 'adminToken' with a real secret

  useEffect(() => {
    if (!isAdmin) {
      // Redirect to a login page or display an error
      router.push('/'); // Redirect to home page if not admin
      return;
    }

    const loadChangelog = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/changelog');
        const data = await response.json();
        if (response.ok) {
          setChangelogContent(data.content);
        } else {
          setError(data.error || 'Failed to load changelog.');
        }
      } catch (err) {
        setError('Failed to load changelog. Please check the console for details.');
        console.error('Error loading changelog:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadChangelog();
  }, [isAdmin, router]);

  const handleUpdateChangelog = async () => {
    try {
      const response = await fetch('/api/changelog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: changelogContent }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('Changelog updated successfully!');
      } else {
        setError(data.error || 'Failed to update changelog.');
      }
    } catch (err) {
      setError('Failed to update changelog. Please check the console for details.');
      console.error('Error updating changelog:', err);
    }
  };

  if (!isAdmin) {
    return <p>You are not authorized to view this page.</p>;
  }

  if (isLoading) {
    return <p>Loading changelog...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  return (
    <div>
      <h1>Changelog Admin</h1>
      <textarea
        rows="20"
        cols="80"
        value={changelogContent}
        onChange={(e) => setChangelogContent(e.target.value)}
      />
      <button onClick={handleUpdateChangelog}>Update Changelog</button>
    </div>
  );
}
