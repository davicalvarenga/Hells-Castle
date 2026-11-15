// Servidor estático mínimo para os testes headless; `overrides` troca o conteúdo de caminhos específicos.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain'
};

export function serve(rootDir, overrides = {}) {
    const root = path.resolve(rootDir);
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
            const file = path.resolve(root, rel);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            let body = fs.readFileSync(file);
            if (overrides[rel]) body = Buffer.from(overrides[rel](body.toString('utf8')));
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(body);
        });
        server.listen(0, '127.0.0.1', () => resolve({
            url: 'http://127.0.0.1:' + server.address().port + '/',
            close: () => server.close()
        }));
    });
}

export const CHROME_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio'];
