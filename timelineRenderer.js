class TimelineRenderer {
    constructor(canvas, audioEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.audioEngine = audioEngine;
        this.pixelsPerSecond = 100;
        this.trackHeight = 80;
        this.trackGap = 20;
        this.selectedTrack = null;
        this.isDragging = false;
        this.isDraggingPlayhead = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.currentTime = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.isCutMode = false;
        this.trackColors = ['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0'];
        this.lastFrameTime = 0;
        this.selectedTrackIndex = null;
        this.lastPlayheadUpdate = 0;

        // Create playhead area
        this.playheadArea = document.createElement('div');
        this.playheadArea.className = 'playhead-area';
        this.canvas.parentElement.insertBefore(this.playheadArea, this.canvas);

        this.setupCanvas();
        this.setupEventListeners();
        this.startAnimationLoop();

        // Callback functions
        this.onTimeUpdate = null;
        this.onPlaybackComplete = null;
    }

    setupCanvas() {
        const updateCanvasSize = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        };

        window.addEventListener('resize', updateCanvasSize);
        updateCanvasSize();
    }

    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        // Check if click is near the playhead (within 5 pixels)
        const playheadX = this.timeToX(this.currentTime);
        if (Math.abs(x - playheadX) <= 5) {
            this.isDraggingPlayhead = true;
            return;
        }
        
        this.isDragging = true;
    }

    handleMouseMove(e) {
        if (!this.isDragging && !this.isDraggingPlayhead) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        if (this.isDraggingPlayhead) {
            this.currentTime = this.xToTime(x);
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime);
            }
            this.render();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isDraggingPlayhead = false;
    }

    handleClick(e) {
        if (this.isDragging || this.isDraggingPlayhead) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const clickedTrack = this.findTrackAtPosition(x, y);
        
        if (this.isCutMode && clickedTrack !== null) {
            this.audioEngine.cutTrackAtTime(clickedTrack, this.currentTime);
            this.render();
        } else {
            this.selectedTrackIndex = clickedTrack;
            this.render();
        }
    }

    findTrackAtPosition(x, y) {
        const trackHeight = this.trackHeight;
        const trackGap = this.trackGap;
        
        for (let i = 0; i < this.audioEngine.tracks.length; i++) {
            const trackY = i * (trackHeight + trackGap);
            if (y >= trackY && y < trackY + trackHeight) {
                return i;
            }
        }
        return null;
    }

    timeToX(time) {
        // Calcular a duração total considerando todas as faixas
        const totalDuration = this.getTotalDuration();
        return (time / totalDuration) * this.canvas.width;
    }

    xToTime(x) {
        const totalDuration = this.getTotalDuration();
        const time = (x / this.canvas.width) * totalDuration;
        return Math.max(0, Math.min(time, totalDuration));
    }

    getTotalDuration() {
        if (!this.audioEngine.tracks || this.audioEngine.tracks.length === 0) {
            return 10; // Duração mínima para exibição
        }
        
        return Math.max(
            this.audioEngine.getTotalDuration(),
            this.currentTime + 5, // Sempre mostrar pelo menos 5 segundos após a posição atual
            10 // Mínimo de 10 segundos
        );
    }

    setIsPlaying(isPlaying, resetTime) {
        this.isPlaying = isPlaying;
        this.isPaused = !isPlaying && !resetTime;
        
        if (resetTime) {
            this.currentTime = 0;
        }
    }

    getCurrentTime() {
        return this.currentTime;
    }

    setCutMode(isCutMode) {
        this.isCutMode = isCutMode;
    }

    getSelectedTrack() {
        return this.selectedTrackIndex;
    }

    clearSelection() {
        this.selectedTrackIndex = null;
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw tracks
        this.drawTracks();
        
        // Draw playhead
        const playheadX = this.timeToX(this.currentTime);
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, this.canvas.height);
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    startAnimationLoop() {
        requestAnimationFrame(this.animationLoop.bind(this));
    }

    animationLoop(timestamp) {
        // Update playhead position if playing
        if (this.isPlaying) {
            if (this.lastFrameTime) {
                const deltaTime = (timestamp - this.lastFrameTime) / 1000;
                this.currentTime += deltaTime;
                
                // Check if reached end
                if (this.currentTime >= this.getTotalDuration()) {
                    this.currentTime = 0;
                    this.isPlaying = false;
                    if (this.onPlaybackComplete) {
                        this.onPlaybackComplete();
                    }
                }
            }
            this.lastFrameTime = timestamp;
        } else {
            this.lastFrameTime = 0;
        }
        
        this.render();
        requestAnimationFrame(this.animationLoop.bind(this));
    }

    drawGrid() {
        // Draw vertical time markers
        this.ctx.strokeStyle = '#333333';
        this.ctx.lineWidth = 1;
        
        // Calcular a duração total considerando todas as faixas
        const totalDuration = this.getTotalDuration();
        
        // Calcular o espaçamento entre as linhas
        const secondWidth = this.canvas.width / totalDuration;
        
        // Draw a line every second
        for (let i = 0; i <= totalDuration; i++) {
            const x = i * secondWidth;
            
            // Desenhar linha vertical
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
            
            // Desenhar marcador de tempo
            this.ctx.fillStyle = '#666666';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(i + 's', x + 2, 15);
            
            // Desenhar marcadores menores a cada 0.5 segundos
            if (i < totalDuration) {
                const halfX = x + (secondWidth / 2);
                this.ctx.beginPath();
                this.ctx.moveTo(halfX, 0);
                this.ctx.lineTo(halfX, 10);
                this.ctx.stroke();
            }
        }
    }

    drawTracks() {
        // Sair se não há tracks
        if (!this.audioEngine.tracks || this.audioEngine.tracks.length === 0) {
            return;
        }
        
        console.log('Drawing tracks:', this.audioEngine.tracks.length);
        
        const trackHeight = this.trackHeight;
        const trackGap = this.trackGap;
        
        this.audioEngine.tracks.forEach((track, index) => {
            // Garantir que temos waveformData para todos os tracks
            if (!track.waveformData) {
                track.waveformData = this.generateWaveformData(track.buffer);
            }

            // Calcular a posição e tamanho da track na linha do tempo
            const trackDuration = track.buffer ? track.buffer.duration : 0;
            const trackX = this.timeToX(track.startTime);
            const trackWidth = (trackDuration / this.getTotalDuration()) * this.canvas.width;
            const trackY = index * (trackHeight + trackGap);
            
            // Draw track background
            this.ctx.fillStyle = index === this.selectedTrackIndex ? '#4a4a4a' : '#2a2a2a';
            this.ctx.fillRect(trackX, trackY, trackWidth, trackHeight);
            
            // Draw track name or index
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Track ${index + 1}`, trackX + 5, trackY + 15);
            
            // Draw waveform if available
            if (track.waveformData) {
                this.ctx.strokeStyle = this.trackColors[index % this.trackColors.length];
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                
                const stepSize = track.waveformData.length / trackWidth;
                
                for (let i = 0; i < trackWidth; i++) {
                    const waveformIndex = Math.floor(i * stepSize);
                    if (waveformIndex < track.waveformData.length) {
                        const amplitude = track.waveformData[waveformIndex] * (trackHeight / 2);
                        
                        const x = trackX + i;
                        const y = trackY + (trackHeight / 2);
                        
                        if (i === 0) {
                            this.ctx.moveTo(x, y - amplitude);
                        } else {
                            this.ctx.lineTo(x, y - amplitude);
                        }
                    }
                }
                
                this.ctx.stroke();
            }
        });
    }

    // Generate waveform data from an audio buffer
    generateWaveformData(buffer) {
        if (!buffer) return [];
        
        const numberOfSamples = 1000; // Número de amostras para representar o buffer
        const waveformData = new Array(numberOfSamples);
        
        const channelData = buffer.getChannelData(0); // Usar o primeiro canal para simplificar
        const samplesPerStep = Math.floor(channelData.length / numberOfSamples);
        
        for (let i = 0; i < numberOfSamples; i++) {
            let sum = 0;
            const sampleIndex = i * samplesPerStep;
            
            // Calcular a média de alguns samples para evitar aliasing
            for (let j = 0; j < samplesPerStep; j++) {
                if (sampleIndex + j < channelData.length) {
                    sum += Math.abs(channelData[sampleIndex + j]);
                }
            }
            
            waveformData[i] = sum / samplesPerStep;
        }
        
        return waveformData;
    }
}

// Export the TimelineRenderer class
export { TimelineRenderer };