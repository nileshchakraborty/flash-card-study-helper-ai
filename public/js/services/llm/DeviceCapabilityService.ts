import type { DeviceCapabilities } from './types.js';

export class DeviceCapabilityService {
    static async detectCapabilities(): Promise<DeviceCapabilities> {
        const hasWebGPU = !!(navigator as any).gpu;

        const hasWebGL = (() => {
            try {
                const canvas = document.createElement('canvas');
                return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
            } catch (e) {
                return false;
            }
        })();

        // Rough estimate of memory in GB (default to 4 if unavailable)
        const memoryEstimate = (navigator as any).deviceMemory || 4;

        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

        let isOnCellular = false;
        const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
        if (connection) {
            isOnCellular = connection.type === 'cellular' ||
                connection.effectiveType === '2g' ||
                connection.effectiveType === '3g'; // Treat 4g as potentially cellular but maybe fast enough, let's be conservative

            if (connection.saveData) {
                isOnCellular = true; // Treat data saver as constrained
            }
        }

        return {
            hasWebGPU,
            hasWebGL,
            memoryEstimate,
            isMobile,
            isOnCellular
        };
    }

    static getTier(caps: DeviceCapabilities): 'high' | 'mid' | 'low' {
        if (caps.hasWebGPU && caps.memoryEstimate >= 8 && !caps.isMobile) {
            return 'high';
        } else if (caps.memoryEstimate >= 4 && !caps.isMobile) {
            // Mid tier: Can run WASM models reasonably well
            return 'mid';
        } else {
            // Low tier: Mobile or low memory -> Remote or very small models
            return 'low';
        }
    }
}
