export declare class ApiService {
    private baseUrl;
    constructor(baseUrl?: string);
    request(endpoint: any, options?: {}): Promise<any>;
    get(endpoint: any): Promise<any>;
    post(endpoint: any, data: any): Promise<any>;
}
export declare const apiService: ApiService;
//# sourceMappingURL=api.service.d.ts.map