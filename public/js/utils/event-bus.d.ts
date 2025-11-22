declare class EventBus {
    private listeners;
    constructor();
    on(event: any, callback: any): () => void;
    off(event: any, callback: any): void;
    emit(event: any, data: any): void;
}
export declare const eventBus: EventBus;
export {};
//# sourceMappingURL=event-bus.d.ts.map