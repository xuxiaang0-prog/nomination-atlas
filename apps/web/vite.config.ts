import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],server:{port:4173,host:'0.0.0.0',strictPort:true,allowedHosts:['terminal.local'],proxy:{'/api':'http://127.0.0.1:5080','/openapi':'http://127.0.0.1:5080'}},test:{environment:'jsdom',setupFiles:['./src/test.setup.ts']}});
