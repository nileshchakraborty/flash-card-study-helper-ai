module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'jsdom',
    extensionsToTreatAsEsm: ['.ts'],
    setupFiles: ['<rootDir>/tests/setup.cjs'],
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@mlc-ai/web-llm$': '<rootDir>/tests/mocks/web-llm.js',
        '^msgpackr$': '<rootDir>/node_modules/msgpackr/dist/node.cjs',
        '^ws$': '<rootDir>/tests/mocks/ws.js',
    },
    transform: {
        '^.+\\.[tj]sx?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: 'tsconfig.json'
            },
        ],
    },
};
