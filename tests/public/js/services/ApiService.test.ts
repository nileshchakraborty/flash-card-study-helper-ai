import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {ApiService} from '../../../../public/js/services/api.service.js';

describe('ApiService', () => {
  let apiService: ApiService;
  let fetchSpy: jest.Mock;
  let originalFetch: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Store original fetch if it exists
    originalFetch = (global as any).fetch || (typeof window !== 'undefined' ? (window as any).fetch : undefined);
    
    // Mock fetch as a function
    fetchSpy = jest.fn();
    
    // Set on both global and window for compatibility
    (global as any).fetch = fetchSpy;
    if (typeof window !== 'undefined') {
      (window as any).fetch = fetchSpy;
    }
    
    // Mock window.location and other browser APIs for jsdom
    if (typeof window !== 'undefined') {
      // Mock location.search getter
      delete (window as any).location;
      (window as any).location = {
        search: '',
        pathname: '/',
      };
      
      // Mock history
      (window as any).history = {
        replaceState: jest.fn(),
      };
      
      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      (window as any).localStorage = localStorageMock;
    }
    
    apiService = new ApiService('/api');
  });
  
  afterEach(() => {
    // Restore original fetch if it existed
    if (originalFetch) {
      (global as any).fetch = originalFetch;
      if (typeof window !== 'undefined') {
        (window as any).fetch = originalFetch;
      }
    } else {
      delete (global as any).fetch;
      if (typeof window !== 'undefined') {
        delete (window as any).fetch;
      }
    }
  });
  
  describe('get', () => {
    it('should make GET request with correct URL', async () => {
      const mockData = {id: 1, name: 'test'};
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);
      
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
      const mockResponse = {cards: [{id: '1', front: 'Q', back: 'A'}]};
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);
      
      const result = await apiService.get('/decks');
      
      expect(result).toEqual(mockResponse);
    });
  });
  
  describe('post', () => {
    it('should make POST request with JSON body', async () => {
      const requestData = {topic: 'Physics', count: 5};
      const responseData = {success: true};
      
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => responseData,
      } as Response);
      
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
        user: {id: 1, name: 'Test'},
        items: [1, 2, 3],
      };
      
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);
      
      await apiService.post('/data', complexData);
      
      const callArgs = fetchSpy.mock.calls[0][1] as any;
      expect(callArgs.body).toBe(JSON.stringify(complexData));
    });
  });
  
  describe('error handling', () => {
    it('should throw error for HTTP 404', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as Response);
      
      await expect(apiService.get('/missing')).rejects.toThrow('API Error: Not Found');
    });
    
    it('should throw error for HTTP 500', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      } as Response);
      
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
      } catch (e) {
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
      } as Response);
      
      await apiService.request('/custom', {
        headers: {
          'X-Custom-Header': 'value',
        },
      } as any);
      
      const callArgs = fetchSpy.mock.calls[0][1] as any;
      // Custom headers are merged, verify the custom header is present
      expect(callArgs.headers['X-Custom-Header']).toBe('value');
    });
    
    it('should use configured base URL', async () => {
      const customService = new ApiService('/v2/api');
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);
      
      await customService.get('/test');
      
      expect(fetchSpy).toHaveBeenCalledWith('/v2/api/test', expect.any(Object));
    });
  });
});
