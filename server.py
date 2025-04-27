from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import os

# Configurar o servidor
port = 8080
server_address = ('', port)
httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)

# Abrir o navegador automaticamente
url = f'http://localhost:{port}'
print(f'Abrindo o editor de áudio em {url}')
webbrowser.open(url)

# Iniciar o servidor
print('Servidor rodando... (Pressione Ctrl+C para parar)')
httpd.serve_forever() 