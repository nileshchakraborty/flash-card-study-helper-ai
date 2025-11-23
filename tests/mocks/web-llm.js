import { jest } from '@jest/globals';

export const MLCEngine = jest.fn().mockImplementation(() => ({
    setInitProgressCallback: jest.fn(),
    reload: jest.fn().mockResolvedValue(undefined),
    chat: {
        completions: {
            create: jest.fn().mockResolvedValue({
                choices: [{ message: { content: 'Mock response' } }]
            })
        }
    },
    unload: jest.fn().mockResolvedValue(undefined)
}));
