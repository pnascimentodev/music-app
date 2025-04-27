// Script de testes para validar a funcionalidade de gravação e exibição de áudio na timeline

// Função para simular automaticamente o processo de gravar e parar
async function testRecording() {
    console.log('Iniciando teste de gravação...');
    
    // Testar a função testAddTrack primeiro
    console.log('Testando a adição de uma faixa simulada...');
    window.testAddTrack();
    
    // Aguardar um momento para verificar se a renderização ocorreu
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar se o botão de gravação está disponível
    const recordButton = document.getElementById('recordButton');
    if (!recordButton) {
        console.error('Botão de gravação não encontrado! Verifique se a página está carregada corretamente.');
        return;
    }
    
    // Simular um clique no botão de gravação
    console.log('Iniciando gravação...');
    recordButton.click();
    
    // Gravar por 3 segundos
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Simular um clique no botão de gravação para parar
    console.log('Parando gravação...');
    recordButton.click();
    
    // Aguardar mais um pouco para verificar se a faixa foi adicionada
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar se as faixas foram adicionadas e renderizadas
    const audioEngine = window.audioEngine; // Assumindo que audioEngine está acessível globalmente
    if (audioEngine) {
        console.log(`Número de faixas: ${audioEngine.tracks.length}`);
        for (let i = 0; i < audioEngine.tracks.length; i++) {
            console.log(`Faixa ${i + 1}: ${audioEngine.tracks[i].buffer ? 'Tem buffer de áudio' : 'Sem buffer'}`);
            console.log(`Duração: ${audioEngine.tracks[i].buffer ? audioEngine.tracks[i].buffer.duration.toFixed(2) + 's' : 'N/A'}`);
        }
    } else {
        console.error('AudioEngine não está acessível globalmente. Modifique o script de teste.');
    }
    
    console.log('Teste concluído. Verifique visualmente na interface se as faixas estão sendo exibidas.');
}

// Execute o teste depois que a página estiver totalmente carregada
window.addEventListener('load', () => {
    // Atraso de 2 segundos para garantir que tudo esteja inicializado
    setTimeout(() => {
        // Adicionar botão para executar os testes manualmente
        const testButton = document.createElement('button');
        testButton.textContent = 'Executar Testes';
        testButton.className = 'btn btn-warning';
        testButton.style.position = 'fixed';
        testButton.style.bottom = '10px';
        testButton.style.right = '10px';
        testButton.style.zIndex = '1000';
        
        testButton.addEventListener('click', () => {
            testRecording();
        });
        
        document.body.appendChild(testButton);
        
        console.log('Script de testes carregado. Clique no botão "Executar Testes" para iniciar os testes.');
    }, 2000);
}); 