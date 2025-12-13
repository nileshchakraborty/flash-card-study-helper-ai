import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const StorageInputSchema = z.object({
    operation: z.enum(["read", "write", "list", "delete"]).describe("Operation to perform"),
    path: z.string().describe("Relative path to file or directory"),
    content: z.string().optional().describe("Content to write (for write operation)"),
});

export const storageTool = {
    name: "storage_tool",
    description: "Read and write files to the filesystem. Use this to persist data or read configurations.",
    inputSchema: {
        type: "object",
        properties: {
            operation: { type: "string", enum: ["read", "write", "list", "delete"], description: "Operation to perform" },
            path: { type: "string", description: "Relative path to file or directory" },
            content: { type: "string", description: "Content to write (for write operation)" }
        },
        required: ["operation", "path"]
    },
    async execute(input: unknown) {
        const args = StorageInputSchema.parse(input);
        const { operation, path: relativePath, content } = args;
        // Basic security: restrict to cwd
        const safePath = path.resolve(process.cwd(), relativePath);
        if (!safePath.startsWith(process.cwd())) {
            throw new Error("Access denied: Path outside working directory");
        }

        switch (operation) {
            case "read":
                try {
                    const data = await fs.readFile(safePath, 'utf-8');
                    return { success: true, data };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            case "write":
                if (content === undefined) throw new Error("Content required for write operation");
                try {
                    await fs.mkdir(path.dirname(safePath), { recursive: true });
                    await fs.writeFile(safePath, content, 'utf-8');
                    return { success: true };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            case "list":
                try {
                    const files = await fs.readdir(safePath);
                    return { success: true, files };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            case "delete":
                try {
                    await fs.rm(safePath, { recursive: true, force: true });
                    return { success: true };
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
};
