module.exports = {
    preset: 'ts-jest/presets/default-esm',
    testEnvironment: 'jsdom',
    extensionsToTreatAsEsm: ['.ts'],
    setupFiles: ['<rootDir>/tests/setup.cjs'],
    testMatch: ['**/*.test.ts', '**/*.test.tsx'],
    collectCoverage: true,
    collectCoverageFrom: [
        'src/core/services/CacheService.ts'
    ],
    coverageThreshold: {
        global: {
            statements: 80,
            branches: 80,
            functions: 80,
            lines: 80,
        },
    },
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
        '^@mlc-ai/web-llm$': '<rootDir>/tests/mocks/web-llm.js',
        '^msgpackr$': '<rootDir>/node_modules/msgpackr/dist/node.cjs',
        '^ws$': '<rootDir>/tests/mocks/ws.js',
        '^uuid$': require.resolve('uuid'),
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
    transformIgnorePatterns: [
        'node_modules/(?!(uuid|@apollo)/)'
    ],
};
