(function() {
    var sharedScripts = ['music.js', 'tailwind', 'lucide', 'pjax.js'];
    var isLoading = false;

    function isSharedScript(src) {
        if (!src) return false;
        return sharedScripts.some(function(s) { return src.indexOf(s) !== -1; });
    }

    // Resolve relative URLs to absolute based on the page URL
    function resolveUrl(relative, baseUrl) {
        if (!relative) return relative;
        if (relative.indexOf('http') === 0) return relative;
        if (relative.indexOf('//') === 0) return relative;
        if (relative.indexOf('data:') === 0) return relative;
        var a = document.createElement('a');
        a.href = relative;
        // Use the base URL to resolve
        var resolver = document.createElement('a');
        resolver.href = baseUrl;
        var resolved = new URL(relative, resolver.href);
        return resolved.href;
    }

    // Fix all relative paths in an element tree
    function fixPaths(container, baseUrl) {
        // Fix images
        container.querySelectorAll('img[src]').forEach(function(img) {
            var src = img.getAttribute('src');
            if (src && src.indexOf('http') !== 0 && src.indexOf('data:') !== 0) {
                img.setAttribute('src', resolveUrl(src, baseUrl));
            }
        });
        // Fix links
        container.querySelectorAll('a[href]').forEach(function(a) {
            var href = a.getAttribute('href');
            if (href && href.indexOf('#') !== 0 && href.indexOf('http') !== 0 && href.indexOf('mailto:') !== 0) {
                a.setAttribute('href', resolveUrl(href, baseUrl));
            }
        });
        // Fix source elements (for video/audio)
        container.querySelectorAll('source[src]').forEach(function(s) {
            var src = s.getAttribute('src');
            if (src && src.indexOf('http') !== 0 && src.indexOf('data:') !== 0) {
                s.setAttribute('src', resolveUrl(src, baseUrl));
            }
        });
        // Fix video/audio poster
        container.querySelectorAll('video[poster]').forEach(function(v) {
            var poster = v.getAttribute('poster');
            if (poster && poster.indexOf('http') !== 0) {
                v.setAttribute('poster', resolveUrl(poster, baseUrl));
            }
        });
    }

    function loadPage(url, pushState) {
        if (isLoading) return Promise.resolve();
        isLoading = true;

        // Remove old page-specific styles
        var oldStyles = document.querySelectorAll('style[data-pjax]');
        oldStyles.forEach(function(s) { s.remove(); });

        return fetch(url)
            .then(function(res) { return res.text(); })
            .then(function(html) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');

                // Change URL FIRST so relative paths resolve correctly
                if (pushState !== false) {
                    history.pushState({ url: url }, '', url);
                }

                // Update title
                if (doc.title) document.title = doc.title;

                // Replace <main> content
                var newMain = doc.querySelector('main');
                var oldMain = document.querySelector('main');
                if (newMain && oldMain) {
                    // Fix relative paths before inserting
                    fixPaths(newMain, url);
                    oldMain.innerHTML = newMain.innerHTML;
                }

                // Inject ALL <style> tags (head + body) to ensure page CSS loads
                var headStyles = doc.head ? Array.from(doc.head.querySelectorAll('style')) : [];
                var bodyStyles = doc.body ? Array.from(doc.body.querySelectorAll('style')) : [];
                var allStyles = headStyles.concat(bodyStyles);
                // Remove old pjax-injected styles first
                var oldPjaxStyles = document.querySelectorAll('style[data-pjax]');
                oldPjaxStyles.forEach(function(s) { s.remove(); });
                allStyles.forEach(function(style) {
                    var styleId = style.getAttribute('id');
                    // For styles with id, replace existing ones with same id
                    if (styleId) {
                        var existing = document.getElementById(styleId);
                        if (existing) {
                            existing.textContent = style.textContent;
                            return; // Skip - already replaced
                        }
                    }
                    // Inject as new pjax style
                    var clone = document.createElement('style');
                    clone.setAttribute('data-pjax', '');
                    if (styleId) clone.setAttribute('id', styleId);
                    // Preserve type attribute (e.g. text/tailwindcss)
                    var styleType = style.getAttribute('type');
                    if (styleType) clone.setAttribute('type', styleType);
                    clone.textContent = style.textContent;
                    document.head.appendChild(clone);
                });

                // Collect page-specific scripts from body
                var newScripts = doc.body ? doc.body.querySelectorAll('script') : [];
                var scriptsToLoad = [];

                newScripts.forEach(function(oldScript) {
                    var src = oldScript.getAttribute('src') || '';
                    if (isSharedScript(src)) return;

                    var newScript = document.createElement('script');
                    for (var i = 0; i < oldScript.attributes.length; i++) {
                        var attr = oldScript.attributes[i];
                        newScript.setAttribute(attr.name, attr.value);
                    }

                    if (src) {
                        // Resolve relative script paths
                        newScript.setAttribute('src', resolveUrl(src, url));
                    } else {
                        newScript.textContent = oldScript.textContent;
                    }
                    scriptsToLoad.push(newScript);
                });

                // Remove old page-specific scripts
                var oldScripts = document.querySelectorAll('script[data-pjax]');
                oldScripts.forEach(function(s) { s.remove(); });

                // Load scripts sequentially
                return loadScriptsSequentially(scriptsToLoad);
            })
            .then(function() {
                // Reset body overflow (clear leftover from panels/modals)
                document.body.style.overflow = '';
                window.scrollTo(0, 0);
                // Trigger DOMContentLoaded so page scripts initialize
                var event = new Event('DOMContentLoaded');
                document.dispatchEvent(event);
                // Handle hash: open projects panel if #project-dock
                var hash = url.split('#')[1];
                if (hash === 'project-dock' && window.openProjectsPanel) {
                    setTimeout(function() { window.openProjectsPanel(); }, 300);
                } else if (hash) {
                    var target = document.getElementById(hash);
                    if (target) target.scrollIntoView({ behavior: 'smooth' });
                }
                isLoading = false;
            })
            .catch(function(e) {
                console.error('Pjax error:', e);
                isLoading = false;
                window.location.href = url;
            });
    }

    function loadScriptsSequentially(scripts) {
        return new Promise(function(resolve) {
            function loadNext(i) {
                if (i >= scripts.length) { resolve(); return; }
                var script = scripts[i];
                script.setAttribute('data-pjax', '');
                if (script.hasAttribute('src')) {
                    script.onload = function() { loadNext(i + 1); };
                    script.onerror = function() { loadNext(i + 1); };
                    document.body.appendChild(script);
                } else {
                    document.body.appendChild(script);
                    loadNext(i + 1);
                }
            }
            loadNext(0);
        });
    }

    function isInternalLink(link) {
        var href = link.getAttribute('href');
        if (!href) return false;
        if (href.charAt(0) === '#') return false;
        if (href.indexOf('mailto:') === 0) return false;
        if (href.indexOf('http') === 0 && href.indexOf(window.location.origin) !== 0) return false;
        if (link.target === '_blank') return false;
        return true;
    }

    function getFullUrl(href) {
        var a = document.createElement('a');
        a.href = href;
        return a.href;
    }

    // Intercept link clicks
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link) return;
        if (!isInternalLink(link)) return;

        var href = link.getAttribute('href');

        // Skip pure hash links on same page
        if (href.indexOf('#') !== -1) {
            var beforeHash = href.split('#')[0];
            if (!beforeHash || beforeHash === window.location.pathname ||
                getFullUrl(beforeHash) === window.location.href.split('#')[0]) {
                return;
            }
        }

        e.preventDefault();
        var fullUrl = getFullUrl(href);
        loadPage(fullUrl, true);
    });

    // Handle back/forward
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.url) {
            loadPage(e.state.url, false);
        } else {
            loadPage(window.location.href, false);
        }
    });

    history.replaceState({ url: window.location.href }, '', window.location.href);
})();
