import { TimelineRenderer } from './timelineRenderer.js';
import { AudioEngine } from './audioEngine.js';

document.addEventListener('DOMContentLoaded', async () => {
    const audioEngine = new AudioEngine();

    const canvas = document.getElementById('timeline');
    const timelineRenderer = new TimelineRenderer(canvas, audioEngine);
    const projectList = document.getElementById('projectList');
    const projectItems = projectList.querySelector('.project-items');

    const recordButton = document.getElementById('recordButton');
    const playButton = document.getElementById('playButton');
    const stopButton = document.getElementById('stopButton');
    const cutButton = document.getElementById('cutButton');
    const saveButton = document.getElementById('saveButton');
    const loadButton = document.getElementById('loadButton');
    const exportButton = document.getElementById('exportButton');
    const deleteButton = document.getElementById('deleteButton');

    // Recording state management
    let isRecording = false;

    // Connect audioEngine events to timelineRenderer
    audioEngine.onTrackAdded = (trackIndex) => {
        console.log('Track added at index:', trackIndex);
        timelineRenderer.render();
    };

    // Add a test function
    window.testAddTrack = async () => {
        // Create a 2 second test tone for testing
        const sampleRate = audioEngine.audioContext.sampleRate;
        const buffer = audioEngine.audioContext.createBuffer(2, sampleRate * 2, sampleRate);
        
        // Fill with a 440Hz sine wave
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                data[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5;
            }
        }
        
        // Add to tracks
        audioEngine.tracks.push({
            buffer: buffer,
            startTime: 0,
            isPlaying: false,
            source: null
        });
        
        if (audioEngine.onTrackAdded) {
            audioEngine.onTrackAdded(audioEngine.tracks.length - 1);
        }
        
        console.log('Test track added, tracks:', audioEngine.tracks.length);
    };

    recordButton.addEventListener('click', async () => {
        if (!isRecording) {
            await audioEngine.startRecording();
            isRecording = true;
            recordButton.classList.add('recording');
            recordButton.innerHTML = `
                <span class="record-icon"></span>
                Parar Gravação
            `;
        } else {
            audioEngine.stopRecording();
            isRecording = false;
            recordButton.classList.remove('recording');
            recordButton.innerHTML = `
                <span class="record-icon"></span>
                Gravar
            `;
        }
    });

    // Playback controls
    playButton.addEventListener('click', () => {
        if (!audioEngine.isPlaying) {
            if (audioEngine.isPaused) {
                audioEngine.resumeAll();
                timelineRenderer.setIsPlaying(true, false);
            } else {
                audioEngine.playAll(timelineRenderer.getCurrentTime());
                timelineRenderer.setIsPlaying(true, false);
            }
            playButton.classList.add('active');
            playButton.innerHTML = `
                <span class="pause-icon"></span>
                Pausar
            `;
        } else {
            audioEngine.pauseAll();
            timelineRenderer.setIsPlaying(false, false);
            playButton.classList.remove('active');
            playButton.innerHTML = `
                <span class="play-icon"></span>
                Play
            `;
        }
    });

    stopButton.addEventListener('click', () => {
        audioEngine.stopAll();
        timelineRenderer.setIsPlaying(false, true);
        playButton.classList.remove('active');
        playButton.innerHTML = `
            <span class="play-icon"></span>
            Play
        `;
    });

    // Cut mode
    cutButton.addEventListener('click', () => {
        const isCutMode = cutButton.classList.toggle('active');
        timelineRenderer.setCutMode(isCutMode);
        canvas.classList.toggle('cutting', isCutMode);
        
        if (isCutMode) {
            cutButton.innerHTML = `
                <span class="cut-icon"></span>
                Cancelar Corte
            `;
            canvas.title = 'Clique em um ponto da track para cortá-la';
        } else {
            cutButton.innerHTML = `
                <span class="cut-icon"></span>
                Cortar
            `;
            canvas.title = 'Clique na linha do tempo para mover a agulha';
        }
    });

    // Handle timeline updates
    timelineRenderer.onTimeUpdate = (time) => {
        if (audioEngine.isPlaying) {
            audioEngine.stopAll();
            audioEngine.playAll(time);
        }
    };

    timelineRenderer.onPlaybackComplete = () => {
        audioEngine.stopAll();
        timelineRenderer.setIsPlaying(false, true);
        playButton.classList.remove('active');
        playButton.innerHTML = `
            <span class="play-icon"></span>
            Play
        `;
    };

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') {
            event.preventDefault();
            playButton.click();
        } else if (event.code === 'KeyR' && event.ctrlKey) {
            event.preventDefault();
            recordButton.click();
        } else if (event.code === 'KeyC' && event.ctrlKey) {
            event.preventDefault();
            cutButton.click();
        } else if (event.code === 'Escape') {
            if (isRecording) {
                recordButton.click();
            }
            if (audioEngine.isPlaying) {
                stopButton.click();
            }
            if (cutButton.classList.contains('active')) {
                cutButton.click();
            }
        }
    });

    // Project management
    function updateProjectList() {
        const projects = audioEngine.listProjects();
        projectItems.innerHTML = projects.map(project => `
            <div class="project-item">
                <span>${project}</span>
                <div class="project-item-actions">
                    <button class="btn btn-secondary btn-sm" onclick="loadProject('${project}')">
                        Carregar
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="deleteProject('${project}')">
                        Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.loadProject = async (name) => {
        const success = await audioEngine.loadProject(name);
        if (success) {
            timelineRenderer.render();
        } else {
            alert('Erro ao carregar o projeto');
        }
    };

    window.deleteProject = (name) => {
        if (confirm(`Deseja excluir o projeto "${name}"?`)) {
            audioEngine.deleteProject(name);
            updateProjectList();
        }
    };

    saveButton.addEventListener('click', async () => {
        const name = prompt('Digite um nome para o projeto:');
        if (name) {
            await audioEngine.saveProject(name);
            updateProjectList();
        }
    });

    loadButton.addEventListener('click', () => {
        const projects = audioEngine.listProjects();
        if (projects.length === 0) {
            alert('Nenhum projeto salvo');
            return;
        }

        const name = prompt('Digite o nome do projeto para carregar:', projects[0]);
        if (name) {
            loadProject(name);
        }
    });

    exportButton.addEventListener('click', async () => {
        if (audioEngine.tracks.length === 0) {
            alert('Nenhuma faixa de áudio para exportar');
            return;
        }

        const blob = await audioEngine.exportToWav();
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'audio_mixado.wav';
        document.body.appendChild(a);
        a.click();
        
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    });

    deleteButton.addEventListener('click', () => {
        const selectedTrack = timelineRenderer.getSelectedTrack();
        if (selectedTrack !== null) {
            if (confirm('Tem certeza que deseja remover esta faixa de áudio?')) {
                audioEngine.deleteTrack(selectedTrack);
                timelineRenderer.clearSelection();
                timelineRenderer.render();
            }
        } else {
            alert('Selecione uma faixa de áudio para remover');
        }
    });

    // Initialize project list
    updateProjectList();
}); 