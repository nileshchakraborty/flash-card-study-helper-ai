const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
    entryPoints: ['public/js/main.ts'],
    bundle: true,
    outfile: 'public/dist/main.js',
    platform: 'browser',
    target: ['es2020'],
    sourcemap: true,
    minify: false, // Set to true for production
    format: 'esm',
    loader: {
        '.ts': 'ts',
    },
    define: {
        'process.env.NODE_ENV': '"development"',
    },
}).catch(() => process.exit(1));
