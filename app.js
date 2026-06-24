/* ============================================
   COURSEFORGE — APPLICATION LOGIC (OAuth + Playlist Export)
   ============================================ */

class CourseForge {
    constructor() {
        this.API_BASE = 'https://www.googleapis.com/youtube/v3';
        this.USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
        // Read + Write scope needed for playlist creation
        this.SCOPES = 'https://www.googleapis.com/auth/youtube';

        this.clientId = localStorage.getItem('cf_client_id') || '';
        this.accessToken = null;
        this.tokenClient = null;
        this.currentCourse = null;
        this.progress = JSON.parse(localStorage.getItem('cf_progress') || '{}');
        this.isSignedIn = false;
        this.isExporting = false;

        this.init();
    }

    // ---- Initialization ----
    init() {
        this.cacheDOM();
        this.bindEvents();

        if (this.clientId) {
            this.els.clientIdInput.value = this.clientId;
        }

        this.els.originUrl.textContent = window.location.origin;
        this.waitForGIS();
    }

    waitForGIS() {
        if (typeof google !== 'undefined' && google.accounts) {
            this.initializeOAuth();
        } else {
            setTimeout(() => this.waitForGIS(), 200);
        }
    }

    initializeOAuth() {
        if (!this.clientId) return;

        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.clientId,
                scope: this.SCOPES,
                callback: (response) => this.handleTokenResponse(response),
                error_callback: (error) => this.handleTokenError(error),
            });
        } catch (err) {
            console.error('OAuth init error:', err);
        }
    }

    cacheDOM() {
        this.els = {
            landingView: document.getElementById('landing-view'),
            loadingView: document.getElementById('loading-view'),
            courseView: document.getElementById('course-view'),

            authSignedOut: document.getElementById('auth-signed-out'),
            authSignedIn: document.getElementById('auth-signed-in'),
            youtubeSigninBtn: document.getElementById('youtube-signin-btn'),
            signoutBtn: document.getElementById('signout-btn'),
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),

            courseForm: document.getElementById('course-form'),
            topicInput: document.getElementById('topic-input'),
            buildBtn: document.getElementById('build-btn'),

            settingsBtn: document.getElementById('settings-btn'),
            settingsModal: document.getElementById('settings-modal'),
            closeSettings: document.getElementById('close-settings'),
            clientIdInput: document.getElementById('client-id-input'),
            saveClientIdBtn: document.getElementById('save-client-id-btn'),
            originUrl: document.getElementById('origin-url'),
            copyOriginBtn: document.getElementById('copy-origin-btn'),

            loadingStatus: document.getElementById('loading-status'),
            stepSearch: document.getElementById('step-search'),
            stepOrganize: document.getElementById('step-organize'),
            stepBuild: document.getElementById('step-build'),

            courseTopicTitle: document.getElementById('course-topic-title'),
            totalVideos: document.getElementById('total-videos'),
            totalTime: document.getElementById('total-time'),
            totalProgress: document.getElementById('total-progress'),
            overallProgressFill: document.getElementById('overall-progress-fill'),
            levelsContainer: document.getElementById('levels-container'),
            backBtn: document.getElementById('back-btn'),
            resetProgressBtn: document.getElementById('reset-progress-btn'),
            exportPlaylistBtn: document.getElementById('export-playlist-btn'),

            videoModal: document.getElementById('video-modal'),
            closeModal: document.getElementById('close-modal'),
            videoPlayerContainer: document.getElementById('video-player-container'),
            modalVideoTitle: document.getElementById('modal-video-title'),
            modalVideoChannel: document.getElementById('modal-video-channel'),

            exportModal: document.getElementById('export-modal'),
            closeExport: document.getElementById('close-export'),
            cancelExportBtn: document.getElementById('cancel-export-btn'),
            startExportBtn: document.getElementById('start-export-btn'),
            playlistTitleInput: document.getElementById('playlist-title-input'),
            playlistDescInput: document.getElementById('playlist-desc-input'),
            exportProgress: document.getElementById('export-progress'),
            exportProgressText: document.getElementById('export-progress-text'),
            exportProgressCount: document.getElementById('export-progress-count'),
            exportProgressFill: document.getElementById('export-progress-fill'),
            exportSuccess: document.getElementById('export-success'),
            exportPlaylistLink: document.getElementById('export-playlist-link'),

            toastContainer: document.getElementById('toast-container'),
        };
    }

    bindEvents() {
        // Auth
        this.els.youtubeSigninBtn.addEventListener('click', () => this.signIn());
        this.els.signoutBtn.addEventListener('click', () => this.signOut());

        // Course
        this.els.courseForm.addEventListener('submit', (e) => { e.preventDefault(); this.buildCourse(); });
        this.els.backBtn.addEventListener('click', () => this.showView('landing'));
        this.els.resetProgressBtn.addEventListener('click', () => this.resetProgress());

        // Settings
        this.els.settingsBtn.addEventListener('click', () => this.openSettings());
        this.els.closeSettings.addEventListener('click', () => this.closeSettingsModal());
        this.els.settingsModal.addEventListener('click', (e) => { if (e.target === this.els.settingsModal) this.closeSettingsModal(); });
        this.els.saveClientIdBtn.addEventListener('click', () => this.saveClientId());
        this.els.copyOriginBtn.addEventListener('click', () => this.copyOrigin());

        // Video modal
        this.els.closeModal.addEventListener('click', () => this.closeVideoModal());
        this.els.videoModal.addEventListener('click', (e) => { if (e.target === this.els.videoModal) this.closeVideoModal(); });

        // Export modal
        this.els.exportPlaylistBtn.addEventListener('click', () => this.openExportModal());
        this.els.closeExport.addEventListener('click', () => this.closeExportModal());
        this.els.cancelExportBtn.addEventListener('click', () => this.closeExportModal());
        this.els.exportModal.addEventListener('click', (e) => { if (e.target === this.els.exportModal && !this.isExporting) this.closeExportModal(); });
        this.els.startExportBtn.addEventListener('click', () => this.exportAsPlaylist());

        // Global escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeVideoModal();
                this.closeSettingsModal();
                if (!this.isExporting) this.closeExportModal();
            }
        });
    }

    // ---- OAuth ----
    signIn() {
        if (!this.clientId) {
            this.showToast('Please set up your OAuth Client ID in Settings first.', 'error');
            this.openSettings();
            return;
        }
        if (!this.tokenClient) this.initializeOAuth();

        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.showToast('Failed to initialize Google sign-in. Check your Client ID in Settings.', 'error');
        }
    }

    async handleTokenResponse(response) {
        if (response.error) {
            console.error('Token error:', response);
            this.showToast(`Sign-in failed: ${response.error}`, 'error');
            return;
        }

        this.accessToken = response.access_token;
        this.isSignedIn = true;

        try {
            const res = await fetch(this.USERINFO_URL, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
            });
            if (res.ok) {
                const user = await res.json();
                this.els.userAvatar.src = user.picture || '';
                this.els.userName.textContent = user.name || user.email || 'YouTube User';
                this.els.userAvatar.style.display = user.picture ? 'block' : 'none';
            }
        } catch (err) {
            console.warn('Could not fetch user profile:', err);
            this.els.userName.textContent = 'YouTube User';
            this.els.userAvatar.style.display = 'none';
        }

        this.els.authSignedOut.style.display = 'none';
        this.els.authSignedIn.style.display = 'block';
        this.showToast('Signed in to YouTube successfully!', 'success');
    }

    handleTokenError(error) {
        console.error('Token client error:', error);
        const origin = window.location.origin;

        if (error.type === 'popup_closed') {
            this.showToast('Sign-in popup was closed.', 'info');
        } else if (error.type === 'popup_failed_to_open') {
            this.showToast('Pop-up blocked by browser. Please allow pop-ups for this site.', 'error');
        } else {
            this.showToast(
                `Sign-in failed. Make sure "${origin}" is added as an Authorized JavaScript Origin in your Google Cloud OAuth Client settings.`,
                'error'
            );
        }
    }

    signOut() {
        if (this.accessToken) {
            google.accounts.oauth2.revoke(this.accessToken, () => {});
        }
        this.accessToken = null;
        this.isSignedIn = false;
        this.els.authSignedOut.style.display = 'block';
        this.els.authSignedIn.style.display = 'none';
        this.showToast('Signed out.', 'info');
    }

    // ---- Settings ----
    openSettings() {
        this.els.settingsModal.classList.add('active');
        this.els.originUrl.textContent = window.location.origin;
        document.body.style.overflow = 'hidden';
    }

    closeSettingsModal() {
        this.els.settingsModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    saveClientId() {
        const clientId = this.els.clientIdInput.value.trim();
        if (!clientId) {
            this.showToast('Please enter a valid OAuth Client ID.', 'error');
            return;
        }
        this.clientId = clientId;
        localStorage.setItem('cf_client_id', clientId);
        this.tokenClient = null;
        this.initializeOAuth();
        this.closeSettingsModal();
        this.showToast('Client ID saved! You can now sign in with YouTube.', 'success');
    }

    copyOrigin() {
        const origin = window.location.origin;
        navigator.clipboard.writeText(origin).then(() => {
            this.showToast(`Copied "${origin}" to clipboard.`, 'success');
        }).catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = origin;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            this.showToast(`Copied "${origin}" to clipboard.`, 'success');
        });
    }

    // ---- Views ----
    showView(name) {
        ['landing', 'loading', 'course'].forEach((v) => {
            document.getElementById(`${v}-view`).classList.remove('active');
        });
        requestAnimationFrame(() => {
            document.getElementById(`${name}-view`).classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ---- Toast ----
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✓', error: '✗', info: 'ℹ' };
        toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
        this.els.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('exiting');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // ---- Loading ----
    setLoadingStep(step) {
        const steps = ['search', 'organize', 'build'];
        const idx = steps.indexOf(step);
        steps.forEach((s, i) => {
            const el = document.getElementById(`step-${s}`);
            el.classList.remove('active', 'done');
            if (i < idx) el.classList.add('done');
            if (i === idx) el.classList.add('active');
        });
        const messages = {
            search: 'Searching for the best tutorials...',
            organize: 'Organizing content by difficulty...',
            build: 'Building your personalized curriculum...',
        };
        this.els.loadingStatus.textContent = messages[step] || '';
    }

    // ---- Build Course ----
    async buildCourse() {
        const topic = this.els.topicInput.value.trim();
        if (!topic) return;

        if (!this.accessToken) {
            this.showToast('Please sign in with YouTube first.', 'error');
            return;
        }

        this.showView('loading');
        this.setLoadingStep('search');

        try {
            const levels = [
                { key: 'beginner', label: 'Beginner', emoji: '🌱', queries: [`${topic} tutorial for beginners`, `${topic} introduction crash course`] },
                { key: 'intermediate', label: 'Intermediate', emoji: '🔥', queries: [`${topic} intermediate tutorial`, `${topic} in depth guide`] },
                { key: 'advanced', label: 'Advanced', emoji: '🚀', queries: [`${topic} advanced tutorial`, `${topic} expert masterclass`] },
            ];

            const courseData = [];
            for (const level of levels) {
                const videos = await this.searchVideos(level.queries, 8);
                courseData.push({ ...level, videos });
            }

            this.setLoadingStep('organize');
            await this.sleep(600);

            const allVideoIds = courseData.flatMap((l) => l.videos.map((v) => v.id));
            const details = await this.getVideoDetails(allVideoIds);

            courseData.forEach((level) => {
                level.videos = level.videos
                    .map((v) => {
                        const detail = details[v.id];
                        if (detail) { v.duration = detail.duration; v.durationSeconds = detail.durationSeconds; v.viewCount = detail.viewCount; v.likeCount = detail.likeCount; }
                        return v;
                    })
                    .filter((v) => v.durationSeconds && v.durationSeconds > 60)
                    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
                    .slice(0, 6);
            });

            this.setLoadingStep('build');
            await this.sleep(600);

            this.currentCourse = { topic, createdAt: new Date().toISOString(), levels: courseData };
            this.renderCourse();
            this.showView('course');
            this.showToast(`Course for "${topic}" is ready!`, 'success');
        } catch (err) {
            console.error('Build course error:', err);
            this.showView('landing');
            if (err.message.includes('401')) {
                this.showToast('Session expired. Please sign in again.', 'error');
                this.signOut();
            } else if (err.message.includes('403')) {
                this.showToast('API quota exceeded or access denied. Try again later.', 'error');
            } else {
                this.showToast(`Error: ${err.message}`, 'error');
            }
        }
    }

    // ---- YouTube API ----
    async apiFetch(url) {
        const res = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`YouTube API ${res.status}: ${errData?.error?.message || 'Unknown error'}`);
        }
        return res.json();
    }

    async apiPost(url, body) {
        const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(`YouTube API ${res.status}: ${errData?.error?.message || 'Unknown error'}`);
        }
        return res.json();
    }

    async searchVideos(queries, maxPerQuery = 8) {
        const seen = new Set();
        const results = [];

        for (const query of queries) {
            const url = new URL(`${this.API_BASE}/search`);
            url.searchParams.set('part', 'snippet');
            url.searchParams.set('q', query);
            url.searchParams.set('type', 'video');
            url.searchParams.set('maxResults', maxPerQuery);
            url.searchParams.set('order', 'relevance');
            url.searchParams.set('videoDuration', 'medium');
            url.searchParams.set('relevanceLanguage', 'en');

            const data = await this.apiFetch(url);
            for (const item of data.items || []) {
                const id = item.id.videoId;
                if (!seen.has(id)) {
                    seen.add(id);
                    results.push({
                        id,
                        title: this.decodeHTML(item.snippet.title),
                        channel: item.snippet.channelTitle,
                        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
                        publishedAt: item.snippet.publishedAt,
                    });
                }
            }
        }
        return results;
    }

    async getVideoDetails(videoIds) {
        const details = {};
        const chunks = this.chunkArray(videoIds, 50);

        for (const chunk of chunks) {
            const url = new URL(`${this.API_BASE}/videos`);
            url.searchParams.set('part', 'contentDetails,statistics');
            url.searchParams.set('id', chunk.join(','));

            const data = await this.apiFetch(url);
            for (const item of data.items || []) {
                const dur = this.parseISO8601Duration(item.contentDetails.duration);
                details[item.id] = {
                    duration: dur.formatted,
                    durationSeconds: dur.totalSeconds,
                    viewCount: parseInt(item.statistics.viewCount || '0'),
                    likeCount: parseInt(item.statistics.likeCount || '0'),
                };
            }
        }
        return details;
    }

    // ---- Export as YouTube Playlist ----
    openExportModal() {
        if (!this.currentCourse) return;

        // Pre-fill
        const topic = this.currentCourse.topic;
        this.els.playlistTitleInput.value = `CourseForge: ${topic}`;
        this.els.playlistDescInput.value = `A structured learning course for "${topic}" covering Beginner, Intermediate, and Advanced levels.\n\nCreated with CourseForge.`;

        // Reset state
        this.els.exportProgress.style.display = 'none';
        this.els.exportSuccess.style.display = 'none';
        this.els.startExportBtn.disabled = false;
        this.els.startExportBtn.style.display = '';
        this.els.cancelExportBtn.textContent = 'Cancel';

        // Check all level checkboxes
        this.els.exportModal.querySelectorAll('.level-checkbox-option input').forEach(cb => cb.checked = true);

        this.els.exportModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeExportModal() {
        if (this.isExporting) return;
        this.els.exportModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    async exportAsPlaylist() {
        if (!this.accessToken || !this.currentCourse) return;

        const title = this.els.playlistTitleInput.value.trim();
        if (!title) {
            this.showToast('Please enter a playlist title.', 'error');
            return;
        }

        const description = this.els.playlistDescInput.value.trim();
        const privacy = this.els.exportModal.querySelector('input[name="playlist-privacy"]:checked')?.value || 'private';

        // Get selected levels
        const selectedLevels = [];
        this.els.exportModal.querySelectorAll('.level-checkbox-option input:checked').forEach(cb => {
            selectedLevels.push(cb.value);
        });
        if (selectedLevels.length === 0) {
            this.showToast('Please select at least one level to export.', 'error');
            return;
        }

        // Gather videos in order
        const videosToAdd = [];
        for (const level of this.currentCourse.levels) {
            if (selectedLevels.includes(level.key)) {
                for (const video of level.videos) {
                    videosToAdd.push(video);
                }
            }
        }

        if (videosToAdd.length === 0) {
            this.showToast('No videos to export.', 'error');
            return;
        }

        this.isExporting = true;
        this.els.startExportBtn.disabled = true;
        this.els.cancelExportBtn.textContent = 'Please wait...';
        this.els.cancelExportBtn.disabled = true;
        this.els.exportProgress.style.display = 'block';
        this.els.exportProgressText.textContent = 'Creating playlist...';
        this.els.exportProgressCount.textContent = '';
        this.els.exportProgressFill.style.width = '0%';

        try {
            // Step 1: Create the playlist
            const playlistData = await this.apiPost(
                `${this.API_BASE}/playlists?part=snippet,status`,
                {
                    snippet: { title, description },
                    status: { privacyStatus: privacy },
                }
            );

            const playlistId = playlistData.id;

            // Step 2: Add each video
            for (let i = 0; i < videosToAdd.length; i++) {
                const video = videosToAdd[i];
                this.els.exportProgressText.textContent = `Adding "${this.truncate(video.title, 40)}"`;
                this.els.exportProgressCount.textContent = `${i + 1} / ${videosToAdd.length}`;
                this.els.exportProgressFill.style.width = `${((i + 1) / videosToAdd.length) * 100}%`;

                try {
                    await this.apiPost(
                        `${this.API_BASE}/playlistItems?part=snippet`,
                        {
                            snippet: {
                                playlistId,
                                resourceId: {
                                    kind: 'youtube#video',
                                    videoId: video.id,
                                },
                            },
                        }
                    );
                } catch (addErr) {
                    console.warn(`Failed to add video ${video.id}:`, addErr);
                    // Continue adding remaining videos
                }

                // Small delay to avoid rate limits
                if (i < videosToAdd.length - 1) {
                    await this.sleep(300);
                }
            }

            // Show success
            this.els.exportProgress.style.display = 'none';
            this.els.startExportBtn.style.display = 'none';
            this.els.exportSuccess.style.display = 'flex';
            this.els.exportPlaylistLink.href = `https://www.youtube.com/playlist?list=${playlistId}`;
            this.els.cancelExportBtn.textContent = 'Done';
            this.els.cancelExportBtn.disabled = false;

            this.showToast(`Playlist "${title}" created with ${videosToAdd.length} videos!`, 'success');
        } catch (err) {
            console.error('Export playlist error:', err);
            this.els.exportProgress.style.display = 'none';
            this.els.startExportBtn.disabled = false;
            this.els.cancelExportBtn.textContent = 'Cancel';
            this.els.cancelExportBtn.disabled = false;

            if (err.message.includes('401')) {
                this.showToast('Session expired. Please sign in again and retry.', 'error');
            } else if (err.message.includes('403')) {
                this.showToast('Permission denied. Make sure you granted full YouTube access when signing in.', 'error');
            } else {
                this.showToast(`Export failed: ${err.message}`, 'error');
            }
        } finally {
            this.isExporting = false;
        }
    }

    // ---- Render Course ----
    renderCourse() {
        const course = this.currentCourse;
        if (!course) return;

        this.els.courseTopicTitle.textContent = course.topic;

        let totalVids = 0, totalSecs = 0;
        course.levels.forEach((level) => {
            totalVids += level.videos.length;
            totalSecs += level.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
        });

        this.els.totalVideos.textContent = totalVids;
        this.els.totalTime.textContent = this.formatDuration(totalSecs);
        this.els.levelsContainer.innerHTML = '';

        course.levels.forEach((level) => {
            const levelSecs = level.videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0);
            const completedCount = level.videos.filter((v) => this.isVideoCompleted(course.topic, v.id)).length;
            const progressPct = level.videos.length > 0 ? Math.round((completedCount / level.videos.length) * 100) : 0;
            const circumference = 2 * Math.PI * 15;
            const dashOffset = circumference - (progressPct / 100) * circumference;
            const levelColor = { beginner: '#34d399', intermediate: '#fbbf24', advanced: '#f87171' }[level.key];

            const card = document.createElement('div');
            card.className = 'level-card';
            card.dataset.level = level.key;

            card.innerHTML = `
                <div class="level-header">
                    <div class="level-header-left">
                        <div class="level-badge">${level.emoji}</div>
                        <div class="level-info">
                            <h2>${level.label}</h2>
                            <div class="level-meta">
                                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>${level.videos.length} videos</span>
                                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${this.formatDuration(levelSecs)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="level-header-right">
                        <div class="level-progress-ring">
                            <svg width="40" height="40" viewBox="0 0 40 40">
                                <circle class="ring-bg" cx="20" cy="20" r="15" fill="none" stroke-width="3"/>
                                <circle class="ring-fill" cx="20" cy="20" r="15" fill="none" stroke="${levelColor}" stroke-width="3" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" stroke-linecap="round"/>
                            </svg>
                            <span class="level-progress-text">${progressPct}%</span>
                        </div>
                        <svg class="level-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
                <div class="level-videos">
                    <div class="videos-list">
                        ${level.videos.map((v) => this.renderVideoCard(v, course.topic)).join('')}
                    </div>
                </div>
            `;

            card.querySelector('.level-header').addEventListener('click', () => card.classList.toggle('expanded'));
            this.els.levelsContainer.appendChild(card);
        });

        this.bindVideoCardEvents();
        this.updateOverallProgress();
    }

    renderVideoCard(video, topic) {
        const isCompleted = this.isVideoCompleted(topic, video.id);
        return `
            <div class="video-card ${isCompleted ? 'completed' : ''}" data-video-id="${video.id}">
                <div class="video-checkbox" data-action="toggle-complete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="video-thumbnail" data-action="play">
                    <img src="${video.thumbnail}" alt="${video.title}" loading="lazy"/>
                    ${video.duration ? `<span class="video-duration-badge">${video.duration}</span>` : ''}
                </div>
                <div class="video-info" data-action="play">
                    <div class="video-title">${video.title}</div>
                    <div class="video-channel">${video.channel}</div>
                    <div class="video-stats">
                        ${video.viewCount ? `<span>${this.formatNumber(video.viewCount)} views</span>` : ''}
                        ${video.duration ? `<span>${video.duration}</span>` : ''}
                    </div>
                </div>
                <button class="video-play-btn" data-action="play" title="Play video">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </button>
            </div>
        `;
    }

    bindVideoCardEvents() {
        this.els.levelsContainer.querySelectorAll('.video-card').forEach((card) => {
            const videoId = card.dataset.videoId;
            const video = this.findVideo(videoId);
            card.addEventListener('click', (e) => {
                const action = e.target.closest('[data-action]')?.dataset.action;
                if (action === 'toggle-complete') this.toggleVideoComplete(videoId, card);
                else if (action === 'play') this.openVideoModal(video);
            });
        });
    }

    // ---- Progress ----
    isVideoCompleted(topic, videoId) { return !!this.progress[`${topic}::${videoId}`]; }

    toggleVideoComplete(videoId, cardEl) {
        const key = `${this.currentCourse.topic}::${videoId}`;
        if (this.progress[key]) { delete this.progress[key]; cardEl.classList.remove('completed'); }
        else { this.progress[key] = true; cardEl.classList.add('completed'); }
        localStorage.setItem('cf_progress', JSON.stringify(this.progress));
        this.updateOverallProgress();
        this.updateLevelProgressRings();
    }

    updateOverallProgress() {
        if (!this.currentCourse) return;
        let total = 0, completed = 0;
        this.currentCourse.levels.forEach((l) => l.videos.forEach((v) => { total++; if (this.isVideoCompleted(this.currentCourse.topic, v.id)) completed++; }));
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        this.els.totalProgress.textContent = `${pct}%`;
        this.els.overallProgressFill.style.width = `${pct}%`;
    }

    updateLevelProgressRings() {
        if (!this.currentCourse) return;
        this.currentCourse.levels.forEach((level) => {
            const card = this.els.levelsContainer.querySelector(`[data-level="${level.key}"]`);
            if (!card) return;
            const cc = level.videos.filter((v) => this.isVideoCompleted(this.currentCourse.topic, v.id)).length;
            const pct = level.videos.length > 0 ? Math.round((cc / level.videos.length) * 100) : 0;
            const circ = 2 * Math.PI * 15;
            const ring = card.querySelector('.ring-fill');
            const text = card.querySelector('.level-progress-text');
            if (ring) ring.setAttribute('stroke-dashoffset', circ - (pct / 100) * circ);
            if (text) text.textContent = `${pct}%`;
        });
    }

    resetProgress() {
        if (!this.currentCourse) return;
        Object.keys(this.progress).forEach((k) => { if (k.startsWith(`${this.currentCourse.topic}::`)) delete this.progress[k]; });
        localStorage.setItem('cf_progress', JSON.stringify(this.progress));
        this.renderCourse();
        this.showToast('Progress has been reset.', 'info');
    }

    // ---- Video Modal ----
    openVideoModal(video) {
        if (!video) return;
        this.els.videoPlayerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        this.els.modalVideoTitle.textContent = video.title;
        this.els.modalVideoChannel.textContent = video.channel;
        this.els.videoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeVideoModal() {
        this.els.videoModal.classList.remove('active');
        this.els.videoPlayerContainer.innerHTML = '';
        document.body.style.overflow = '';
    }

    // ---- Utilities ----
    findVideo(videoId) {
        if (!this.currentCourse) return null;
        for (const l of this.currentCourse.levels) { const f = l.videos.find((v) => v.id === videoId); if (f) return f; }
        return null;
    }

    parseISO8601Duration(iso) {
        const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!m) return { formatted: '0:00', totalSeconds: 0 };
        const h = parseInt(m[1] || '0'), min = parseInt(m[2] || '0'), s = parseInt(m[3] || '0');
        const totalSeconds = h * 3600 + min * 60 + s;
        const formatted = h > 0 ? `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${min}:${String(s).padStart(2,'0')}`;
        return { formatted, totalSeconds };
    }

    formatDuration(ts) {
        const h = Math.floor(ts / 3600), m = Math.floor((ts % 3600) / 60);
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        return `${m}m`;
    }

    formatNumber(n) {
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toString();
    }

    truncate(str, maxLen) {
        return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
    }

    decodeHTML(html) { const t = document.createElement('textarea'); t.innerHTML = html; return t.value; }
    chunkArray(arr, sz) { const c = []; for (let i = 0; i < arr.length; i += sz) c.push(arr.slice(i, i + sz)); return c; }
    sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
}

document.addEventListener('DOMContentLoaded', () => { window.courseForge = new CourseForge(); });
