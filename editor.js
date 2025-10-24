// Javascript code for the basic video editor
const videoUpload = document.getElementById('videoUpload');
        const videoPlayer = document.getElementById('videoPlayer');
        const playButton = document.getElementById('playButton');
        const pauseButton = document.getElementById('pauseButton');
        const timeline = document.getElementById('timeline');

        videoUpload.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            videoPlayer.src = url;
        });

        playButton.addEventListener('click', function() {
            videoPlayer.play();
        });

        pauseButton.addEventListener('click', function() {
            videoPlayer.pause();
        });

        videoPlayer.addEventListener('loadedmetadata', function() {
            timeline.max = videoPlayer.duration;
        });

       videoPlayer.addEventListener('timeupdate', function() {
            timeline.value = videoPlayer.currentTime;
        });

        timeline.addEventListener('input', function() {
            videoPlayer.currentTime = timeline.value;
        });
var canvas = document.getElementById("myCanvas");
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#FF0000";
        ctx.fillRect(0,0,150,75);
