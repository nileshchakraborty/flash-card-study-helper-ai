import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ApiService } from '../../../../public/js/services/api.service.js';
describe('ApiService', () => {
    let apiService;
    let fetchSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        apiService = new ApiService('/api');
        fetchSpy = jest.spyOn(global, 'fetch');
    });
    afterEach(() => {
        fetchSpy.mockRestore();
    });
    describe('get', () => {
        it('should make GET request with correct URL', async () => {
            const mockData = { id: 1, name: 'test' };
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => mockData,
            });
            const result = await apiService.get('/users');
            expect(fetchSpy).toHaveBeenCalledWith('/api/users', expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
            }));
            expect(result).toEqual(mockData);
        });
        it('should parse JSON response correctly', async () => {
            const mockResponse = { cards: [{ id: '1', front: 'Q', back: 'A' }] };
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => mockResponse,
            });
            const result = await apiService.get('/decks');
            expect(result).toEqual(mockResponse);
        });
    });
    describe('post', () => {
        it('should make POST request with JSON body', async () => {
            const requestData = { topic: 'Physics', count: 5 };
            const responseData = { success: true };
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => responseData,
            });
            const result = await apiService.post('/generate', requestData);
            expect(fetchSpy).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Content-Type': 'application/json',
                }),
                body: JSON.stringify(requestData),
            }));
            expect(result).toEqual(responseData);
        });
        it('should stringify request data', async () => {
            const complexData = {
                user: { id: 1, name: 'Test' },
                items: [1, 2, 3],
            };
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });
            await apiService.post('/data', complexData);
            const callArgs = fetchSpy.mock.calls[0][1];
            expect(callArgs.body).toBe(JSON.stringify(complexData));
        });
    });
    describe('error handling', () => {
        it('should throw error for HTTP 404', async () => {
            fetchSpy.mockResolvedValue({
                ok: false,
                statusText: 'Not Found',
            });
            await expect(apiService.get('/missing')).rejects.toThrow('API Error: Not Found');
        });
        it('should throw error for HTTP 500', async () => {
            fetchSpy.mockResolvedValue({
                ok: false,
                statusText: 'Internal Server Error',
            });
            await expect(apiService.post('/fail', {})).rejects.toThrow('API Error: Internal Server Error');
        });
        it('should handle network errors', async () => {
            const networkError = new Error('Network failure');
            fetchSpy.mockRejectedValue(networkError);
            await expect(apiService.get('/endpoint')).rejects.toThrow('Network failure');
        });
        it('should log errors to console', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            fetchSpy.mockRejectedValue(new Error('Test error'));
            try {
                await apiService.get('/test');
            }
            catch (e) {
                // Expected to throw
            }
            expect(consoleErrorSpy).toHaveBeenCalledWith('API Request Failed:', expect.any(Error));
            consoleErrorSpy.mockRestore();
        });
    });
    describe('request', () => {
        it('should merge custom headers with defaults', async () => {
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });
            await apiService.request('/custom', {
                headers: {
                    'X-Custom-Header': 'value',
                },
            });
            const callArgs = fetchSpy.mock.calls[0][1];
            // Custom headers are merged, verify the custom header is present
            expect(callArgs.headers['X-Custom-Header']).toBe('value');
        });
        it('should use configured base URL', async () => {
            const customService = new ApiService('/v2/api');
            fetchSpy.mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });
            await customService.get('/test');
            expect(fetchSpy).toHaveBeenCalledWith('/v2/api/test', expect.any(Object));
        });
    });
});
//# sourceMappingURL=ApiService.test.js.map