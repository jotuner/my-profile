(function() {
    var audio = null;
    var isPlaying = false;
    var wantPlaying = false;
    var musicInited = false;

    function getAudioPath() {
        var path = window.location.pathname;
        if (path.indexOf('/pages/') !== -1) {
            return '../assets/bgm.mp3';
        }
        return 'assets/bgm.mp3';
    }

    function initAudio() {
        if (audio) return;
        audio = new Audio();
        audio.src = getAudioPath();
        audio.loop = true;
        audio.volume = parseFloat(sessionStorage.getItem('music-volume')) || 0.5;
        audio.preload = 'auto';

        var savedTime = parseFloat(sessionStorage.getItem('music-time')) || 0;
        audio.addEventListener('loadedmetadata', function() {
            var t = parseFloat(sessionStorage.getItem('music-time')) || 0;
            if (t > 0 && t < audio.duration) {
                audio.currentTime = t + 0.3;
            }
        });

        audio.addEventListener('timeupdate', function() {
            if (audio && !audio.paused) {
                sessionStorage.setItem('music-time', audio.currentTime);
            }
        });

        audio.addEventListener('play', function() {
            sessionStorage.setItem('music-playing', 'true');
        });
    }

    function startMusic() {
        initAudio();
        wantPlaying = true;
        audio.play().then(function() {
            isPlaying = true;
            sessionStorage.setItem('music-playing', 'true');
            updateMusicUI(true);
        }).catch(function(e) {
            isPlaying = false;
            updateMusicUI(false);
        });
    }

    function stopMusic() {
        wantPlaying = false;
        if (audio) {
            sessionStorage.setItem('music-time', audio.currentTime);
            audio.pause();
        }
        isPlaying = false;
        sessionStorage.setItem('music-playing', 'false');
        updateMusicUI(false);
    }

    function toggleMusic() {
        if (wantPlaying) stopMusic(); else startMusic();
    }

    function updateMusicUI(playing) {
        var icon = document.getElementById('music-icon');
        var dot = document.getElementById('music-dot');
        if (icon) {
            icon.setAttribute('data-lucide', playing ? 'volume-2' : 'music');
            if (window.lucide) lucide.createIcons();
        }
        if (dot) {
            if (playing) dot.classList.remove('hidden');
            else dot.classList.add('hidden');
        }
    }

    window.__musicToggle = toggleMusic;
    window.__musicIsPlaying = function() { return isPlaying; };

    function bindButton() {
        var btn = document.getElementById('btn-music');
        if (btn) {
            // Remove old listener by cloning the node
            var newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                toggleMusic();
            });
            return true;
        }
        return false;
    }

    function init() {
        if (musicInited) return;
        musicInited = true;

        bindButton();
        var shouldPlay = sessionStorage.getItem('music-playing') === 'true';

        if (shouldPlay) {
            wantPlaying = true;
            initAudio();
            audio.play().then(function() {
                isPlaying = true;
                updateMusicUI(true);
            }).catch(function() {
                updateMusicUI(false);
                function resumeOnInteract() {
                    if (wantPlaying && !isPlaying) {
                        audio.play().then(function() {
                            isPlaying = true;
                            updateMusicUI(true);
                        }).catch(function() {});
                    }
                    document.removeEventListener('click', resumeOnInteract);
                    document.removeEventListener('scroll', resumeOnInteract);
                    document.removeEventListener('touchstart', resumeOnInteract);
                    document.removeEventListener('keydown', resumeOnInteract);
                }
                document.addEventListener('click', resumeOnInteract);
                document.addEventListener('scroll', resumeOnInteract, { passive: true });
                document.addEventListener('touchstart', resumeOnInteract, { passive: true });
                document.addEventListener('keydown', resumeOnInteract);
            });
        } else {
            wantPlaying = true;
            var autoStarted = false;
            function tryAutoStart() {
                if (!autoStarted) {
                    autoStarted = true;
                    setTimeout(startMusic, 200);
                }
            }
            document.addEventListener('click', tryAutoStart, { once: true });
            document.addEventListener('scroll', tryAutoStart, { once: true, passive: true });
            document.addEventListener('touchstart', tryAutoStart, { once: true, passive: true });
        }

        window.addEventListener('beforeunload', function() {
            if (audio && !audio.paused) {
                sessionStorage.setItem('music-time', audio.currentTime);
            }
        });
        window.addEventListener('pagehide', function() {
            if (audio && !audio.paused) {
                sessionStorage.setItem('music-time', audio.currentTime);
            }
        });
    }

    // Re-bind button on pjax navigation (DOMContentLoaded dispatched by pjax.js)
    document.addEventListener('DOMContentLoaded', function() {
        if (musicInited) {
            // Pjax content was replaced, re-bind the button
            bindButton();
            // Update UI to reflect current playing state
            updateMusicUI(isPlaying);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
