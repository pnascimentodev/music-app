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
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        // Altura dinâmica baseada no número de tracks, sem limitar pelo container
        this.canvas.height = Math.max(400, this.audioEngine.tracks.length * (this.trackHeight + this.trackGap));
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
        const y = e.clientY - rect.top;
        
        // Verificar se clicou no playhead
        const playheadX = this.timeToX(this.currentTime);
        if (Math.abs(x - playheadX) <= 5) {
            this.isDraggingPlayhead = true;
            this.dragStartX = x;
            this.dragStartTime = this.currentTime;
            return;
        }
        
        // Verificar se clicou em uma track
        const trackIndex = this.findTrackAtPosition(x, y);
        if (trackIndex !== null) {
            const track = this.audioEngine.tracks[trackIndex];
            const trackX = this.timeToX(track.startTime);
            const trackWidth = this.timeToX(track.buffer.duration);
            
            // Verificar se o clique foi dentro da área da track
            if (x >= trackX && x <= trackX + trackWidth) {
                this.selectedTrackIndex = trackIndex;
                this.isDragging = true;
                this.dragStartX = x;
                this.dragStartY = y;
                this.dragStartTime = track.startTime;
                this.render();
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDraggingPlayhead) {
            const deltaX = x - this.dragStartX;
            const deltaTime = this.xToTime(deltaX);
            this.currentTime = this.dragStartTime + deltaTime;
            
            if (this.onTimeUpdate) {
                this.onTimeUpdate(this.currentTime);
            }
            this.render();
        } else if (this.isDragging && this.selectedTrackIndex !== null) {
            const track = this.audioEngine.tracks[this.selectedTrackIndex];
            const deltaX = x - this.dragStartX;
            const deltaTime = this.xToTime(deltaX);
            const newStartTime = this.dragStartTime + deltaTime;
            
            // Permitir movimentação para trás
            this.audioEngine.moveTrack(this.selectedTrackIndex, newStartTime);
            this.render();
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isDraggingPlayhead = false;
        this.render();
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
        return time * this.pixelsPerSecond;
    }

    xToTime(x) {
        return x / this.pixelsPerSecond;
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
        // Atualizar altura do canvas dinamicamente
        this.setupCanvas();
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
        const trackHeight = this.trackHeight;
        const trackGap = this.trackGap;
        const cornerRadius = 8;

        this.audioEngine.tracks.forEach((track, index) => {
            const y = index * (trackHeight + trackGap);
            const trackColor = this.trackColors[index % this.trackColors.length];
            const trackX = this.timeToX(track.startTime);
            const trackWidth = this.timeToX(track.buffer.duration);
            
            // Desenhar separador entre tracks
            if (index > 0) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y - trackGap/2);
                this.ctx.lineTo(this.canvas.width, y - trackGap/2);
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }
            
            // Desenhar nome da track
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Track ${index + 1}`, 10, y + 20);
            
            // Desenhar fundo da track
            this.ctx.beginPath();
            this.ctx.moveTo(trackX + cornerRadius, y);
            this.ctx.lineTo(trackX + trackWidth - cornerRadius, y);
            this.ctx.quadraticCurveTo(trackX + trackWidth, y, trackX + trackWidth, y + cornerRadius);
            this.ctx.lineTo(trackX + trackWidth, y + trackHeight - cornerRadius);
            this.ctx.quadraticCurveTo(trackX + trackWidth, y + trackHeight, trackX + trackWidth - cornerRadius, y + trackHeight);
            this.ctx.lineTo(trackX + cornerRadius, y + trackHeight);
            this.ctx.quadraticCurveTo(trackX, y + trackHeight, trackX, y + trackHeight - cornerRadius);
            this.ctx.lineTo(trackX, y + cornerRadius);
            this.ctx.quadraticCurveTo(trackX, y, trackX + cornerRadius, y);
            this.ctx.closePath();
            
            // Preencher com cor e gradiente
            const gradient = this.ctx.createLinearGradient(trackX, y, trackX, y + trackHeight);
            gradient.addColorStop(0, trackColor + '80');
            gradient.addColorStop(1, trackColor + '40');
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            // Borda da track
            this.ctx.strokeStyle = trackColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Desenhar waveform
            if (track.buffer) {
                const waveformData = this.generateWaveformData(track.buffer);
                
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 1;
                
                for (let i = 0; i < waveformData.length; i++) {
                    const x = trackX + (i / waveformData.length) * trackWidth;
                    const amplitude = waveformData[i] * (trackHeight / 2);
                    const yCenter = y + trackHeight / 2;
                    
                    if (i === 0) {
                        this.ctx.moveTo(x, yCenter - amplitude);
                    } else {
                        this.ctx.lineTo(x, yCenter - amplitude);
                    }
                }
                
                for (let i = waveformData.length - 1; i >= 0; i--) {
                    const x = trackX + (i / waveformData.length) * trackWidth;
                    const amplitude = waveformData[i] * (trackHeight / 2);
                    const yCenter = y + trackHeight / 2;
                    this.ctx.lineTo(x, yCenter + amplitude);
                }
                
                this.ctx.closePath();
                this.ctx.fillStyle = trackColor + '40';
                this.ctx.fill();
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