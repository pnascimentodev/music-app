class AudioEngine {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.tracks = [];
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentTrackIndex = 0;
        this.startTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedAt = 0;
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
    }

    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            return true;
        } catch (error) {
            console.error('Error initializing AudioContext:', error);
            return false;
        }
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];
            this.isRecording = true;

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.recordedChunks, { type: 'audio/wav' });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                this.tracks.push({
                    buffer: audioBuffer,
                    startTime: 0,
                    isPlaying: false,
                    source: null
                });

                if (this.onTrackAdded) {
                    this.onTrackAdded(this.tracks.length - 1);
                }
            };

            this.mediaRecorder.start();
        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    playTrack(trackIndex, startFrom = 0) {
        const track = this.tracks[trackIndex];
        if (!track) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = track.buffer;
        source.connect(this.masterGainNode);
        
        track.source = source;
        track.isPlaying = true;

        // Calculate offset and start time
        const offset = Math.max(0, startFrom - track.startTime);
        if (offset < track.buffer.duration) {
            source.start(this.audioContext.currentTime, offset);
        }

        source.onended = () => {
            track.isPlaying = false;
            track.source = null;
        };
    }

    stopTrack(trackIndex) {
        const track = this.tracks[trackIndex];
        if (track && track.source) {
            track.source.stop();
            track.isPlaying = false;
            track.source = null;
        }
    }

    playAll(startFrom = 0) {
        this.isPlaying = true;
        this.isPaused = false;
        this.startTime = this.audioContext.currentTime - startFrom;

        this.tracks.forEach((track, index) => {
            if (startFrom < track.startTime + track.buffer.duration) {
                this.playTrack(index, startFrom);
            }
        });
    }

    pauseAll() {
        this.isPaused = true;
        this.isPlaying = false;
        this.pausedAt = this.audioContext.currentTime - this.startTime;
        
        this.tracks.forEach(track => {
            if (track.source) {
                track.source.stop();
                track.isPlaying = false;
                track.source = null;
            }
        });
    }

    resumeAll() {
        if (this.isPaused) {
            this.playAll(this.pausedAt);
        }
    }

    stopAll() {
        this.isPlaying = false;
        this.isPaused = false;
        this.pausedAt = 0;
            
        this.tracks.forEach(track => {
            if (track.source) {
                track.source.stop();
                track.isPlaying = false;
                track.source = null;
            }
        });
    }

    cutTrackAtTime(trackIndex, cutTime) {
        const track = this.tracks[trackIndex];
        if (!track) return;

        // Ensure cut time is within track bounds
        if (cutTime <= track.startTime || cutTime >= track.startTime + track.buffer.duration) {
            console.log('Cut position is outside track bounds');
            return;
        }

        // Calculate the duration of each segment
        const firstSegmentDuration = cutTime - track.startTime;
        const secondSegmentDuration = (track.startTime + track.buffer.duration) - cutTime;

        // Ensure both segments have valid durations
        if (firstSegmentDuration <= 0 || secondSegmentDuration <= 0) {
            console.log('Invalid segment duration');
            return;
        }

        // Create buffers for both segments
        const firstSegment = this.audioContext.createBuffer(
            track.buffer.numberOfChannels,
            Math.floor(firstSegmentDuration * this.audioContext.sampleRate),
            this.audioContext.sampleRate
        );

        const secondSegment = this.audioContext.createBuffer(
            track.buffer.numberOfChannels,
            Math.floor(secondSegmentDuration * this.audioContext.sampleRate),
            this.audioContext.sampleRate
        );

        // Copy the audio data to the new buffers
        for (let channel = 0; channel < track.buffer.numberOfChannels; channel++) {
            const firstSegmentData = firstSegment.getChannelData(channel);
            const secondSegmentData = secondSegment.getChannelData(channel);
            const originalData = track.buffer.getChannelData(channel);

            const firstSegmentSamples = Math.floor(firstSegmentDuration * this.audioContext.sampleRate);
            
            // Copy first segment
            for (let i = 0; i < firstSegmentSamples; i++) {
                firstSegmentData[i] = originalData[i];
            }

            // Copy second segment
            for (let i = 0; i < secondSegmentData.length; i++) {
                secondSegmentData[i] = originalData[i + firstSegmentSamples];
            }
        }

        // Create new tracks with the segments
        const firstTrack = {
            buffer: firstSegment,
            startTime: track.startTime,
            source: null,
            gainNode: this.audioContext.createGain()
        };

        const secondTrack = {
            buffer: secondSegment,
            startTime: cutTime,
            source: null,
            gainNode: this.audioContext.createGain()
        };

        firstTrack.gainNode.connect(this.masterGainNode);
        secondTrack.gainNode.connect(this.masterGainNode);

        // Replace the original track with the two new tracks
        this.tracks.splice(trackIndex, 1, firstTrack, secondTrack);
    }

    moveTrack(trackIndex, newStartTime) {
        const track = this.tracks[trackIndex];
        if (track) {
            track.startTime = Math.max(0, newStartTime);
            if (this.onTrackModified) {
                this.onTrackModified(trackIndex);
            }
        }
    }

    getTrackDuration(trackIndex) {
        const track = this.tracks[trackIndex];
        return track ? track.buffer.duration : 0;
    }

    getTotalDuration() {
        if (!this.tracks || this.tracks.length === 0) {
            return 0;
        }
        
        return Math.max(...this.tracks.map(track => 
            track.startTime + (track.buffer ? track.buffer.duration : 0)
        ), 0);
    }

    async exportToWav() {
        const totalDuration = this.getTotalDuration();
        const offlineContext = new OfflineAudioContext(2, totalDuration * 44100, 44100);

        // Create sources and connect them
        const sources = this.tracks.map(track => {
            const source = offlineContext.createBufferSource();
            source.buffer = track.buffer;
            source.connect(offlineContext.destination);
            source.start(track.startTime);
            return source;
        });

        // Render audio
        const renderedBuffer = await offlineContext.startRendering();

        // Convert to WAV
        const wav = this.audioBufferToWav(renderedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });
        
        return blob;
    }

    audioBufferToWav(buffer) {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;
        
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        
        const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
        const view = new DataView(wav);
        
        // Write WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + buffer.length * blockAlign, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, format, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, buffer.length * blockAlign, true);
        
        // Write audio data
        const offset = 44;
        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
            
        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numChannels; channel++) {
                const sample = Math.max(-1, Math.min(1, channels[channel][i]));
                const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), int16, true);
            }
        }
        
        return wav;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async saveProject(name) {
        const projectData = {
            name,
            tracks: await Promise.all(this.tracks.map(async track => {
                const arrayBuffer = this.audioBufferToArrayBuffer(track.buffer);
                return {
                    buffer: arrayBuffer,
                    startTime: track.startTime,
                    isPlaying: false,
                    source: null
                };
            }))
        };

        localStorage.setItem(`audioproject_${name}`, JSON.stringify(projectData));
        return name;
    }

    async loadProject(name) {
        const projectData = JSON.parse(localStorage.getItem(`audioproject_${name}`));
        if (!projectData) return false;

        this.tracks = await Promise.all(projectData.tracks.map(async trackData => {
            const arrayBuffer = new Float32Array(trackData.buffer).buffer;
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            return {
                buffer: audioBuffer,
                startTime: trackData.startTime,
                isPlaying: false,
                source: null
            };
        }));

        return true;
    }

    audioBufferToArrayBuffer(audioBuffer) {
        const channelData = audioBuffer.getChannelData(0);
        return Array.from(channelData);
    }

    listProjects() {
        return Object.keys(localStorage)
            .filter(key => key.startsWith('audioproject_'))
            .map(key => key.replace('audioproject_', ''));
    }

    deleteProject(name) {
        localStorage.removeItem(`audioproject_${name}`);
    }

    setTrackVolume(trackIndex, volume) {
        if (trackIndex >= 0 && trackIndex < this.tracks.length) {
            this.tracks[trackIndex].gainNode.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    setMasterVolume(volume) {
        if (volume >= 0 && volume <= 1) {
            this.masterGainNode.gain.value = volume;
        }
    }
}

export { AudioEngine }; 