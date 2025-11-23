import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
// We'll assume the worker is available at a standard path or bundled
// For esbuild, we might need to copy the worker file to public/dist or use a CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export class FileProcessingService {
    static async processFiles(files: File[]): Promise<string> {
        const texts = await Promise.all(files.map(file => this.extractText(file)));
        return texts.join('\n\n---\n\n');
    }

    private static async extractText(file: File): Promise<string> {
        if (file.type === 'application/pdf') {
            return this.extractPdfText(file);
        } else if (file.type.startsWith('text/')) {
            return this.extractPlainText(file);
        } else {
            console.warn(`Unsupported file type: ${file.type}`);
            return `[Unsupported file type: ${file.name}]`;
        }
    }

    private static async extractPlainText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    private static async extractPdfText(file: File): Promise<string> {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');
                fullText += `Page ${i}:\n${pageText}\n\n`;
            }
            return fullText;
        } catch (error) {
            console.error("Error parsing PDF:", error);
            throw new Error(`Failed to parse PDF ${file.name}`);
        }
    }
}
