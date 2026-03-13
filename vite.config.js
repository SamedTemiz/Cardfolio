import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    server: {
        // This middleware handles path-based routing in local development
        // matching the Cloudflare _redirects logic
        proxy: {
            // No actual proxy needed, we just use the configure function
        }
    },
    plugins: [
        {
            name: 'hybrid-routing',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    const url = req.url || "";
                    // Only sub-paths that don't look like files or internal Vite/src folders
                    if (url.includes('.') || url.startsWith('/src') || url.startsWith('/@') || url.startsWith('/node_modules')) {
                        return next();
                    }

                    const parts = url.split('/').filter(p => p);
                    
                    // Specific Page Handlers
                    if (url === '/admin' || url === '/admin/') { req.url = '/admin.html'; return next(); }
                    
                    if (parts.length >= 1) {
                        // /id/name/profile
                        if (parts[parts.length - 1] === 'profile') {
                            req.url = '/profile.html';
                        } 
                        // /id/name/project/pid
                        else if (parts.includes('project')) {
                            req.url = '/project-detail.html';
                        }
                        // /id/name
                        else {
                            req.url = '/index.html';
                        }
                    }
                    next();
                });
            }
        }
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                profile: resolve(__dirname, 'profile.html'),
                projectDetail: resolve(__dirname, 'project-detail.html')
            }
        }
    }
});
