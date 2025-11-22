import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {eventBus} from '../../../../public/js/utils/event-bus.js';

describe('EventBus', () => {
  beforeEach(() => {
    // Clear all listeners before each test
    (eventBus as any).listeners = {};
  });
  
  describe('on', () => {
    it('should register event listener', () => {
      const callback = jest.fn();
      
      eventBus.on('test-event', callback);
      eventBus.emit('test-event', {data: 'test'});
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({data: 'test'});
    });
    
    it('should support multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);
      eventBus.emit('test-event', 'data');
      
      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
    });
    
    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      
      const unsubscribe = eventBus.on('test-event', callback);
      unsubscribe();
      eventBus.emit('test-event', 'data');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('off', () => {
    it('should remove specific event listener', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      eventBus.on('test-event', callback1);
      eventBus.on('test-event', callback2);
      
      eventBus.off('test-event', callback1);
      eventBus.emit('test-event', 'data');
      
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('data');
    });
    
    it('should handle removing non-existent listener gracefully', () => {
      const callback = jest.fn();
      
      // Should not throw error
      eventBus.off('non-existent', callback);
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
  
  describe('emit', () => {
    it('should trigger all registered listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();
      
      eventBus.on('event1', callback1);
      eventBus.on('event1', callback2);
      eventBus.on('event2', callback3);
      
      eventBus.emit('event1', {value: 123});
      
      expect(callback1).toHaveBeenCalledWith({value: 123});
      expect(callback2).toHaveBeenCalledWith({value: 123});
      expect(callback3).not.toHaveBeenCalled();
    });
    
    it('should handle emitting to non-existent event gracefully', () => {
      // Should not throw error
      expect(() => {
        eventBus.emit('non-existent', 'data');
      }).not.toThrow();
    });
    
    it('should pass correct data to listeners', () => {
      const callback = jest.fn();
      const testData = {id: 1, name: 'test', nested: {value: true}};
      
      eventBus.on('test-event', callback);
      eventBus.emit('test-event', testData);
      
      expect(callback).toHaveBeenCalledWith(testData);
    });
  });
  
  describe('event isolation', () => {
    it('should keep events separate', () => {
      const cardCallback = jest.fn();
      const deckCallback = jest.fn();
      
      eventBus.on('card:changed', cardCallback);
      eventBus.on('deck:finished', deckCallback);
      
      eventBus.emit('card:changed', {id: '1'});
      
      expect(cardCallback).toHaveBeenCalledWith({id: '1'});
      expect(deckCallback).not.toHaveBeenCalled();
    });
  });
});
