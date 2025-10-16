import React from 'react';

const DownloadFile = () => {
  const handleDownload = () => {
    // Create a blob with the content you want to download
    const blob = new Blob(['This is the file content.'], { type: 'text/plain' });

    // Create a link element
    const link = document.createElement('a');

    // Set the download attribute and the URL of the blob
    link.download = 'downloaded_file.txt';
    link.href = window.URL.createObjectURL(blob);

    // Append the link to the document
    document.body.appendChild(link);

    // Trigger the download
    link.click();

    // Remove the link from the document
    document.body.removeChild(link);
  };

  return (
    <div>
      <button onClick={handleDownload}>Download File</button>
    </div>
  );
};

export default DownloadFile;