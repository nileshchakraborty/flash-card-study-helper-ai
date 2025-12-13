import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), 'data/flashcards.json'); // Default path

const DatabaseInputSchema = z.object({
    operation: z.enum(["query", "save"]).describe("Operation to perform"),
    collection: z.literal("flashcards").describe("Collection to operate on"),
    query: z.record(z.string(), z.any()).optional().describe("Query filter (for query op)"),
    data: z.any().optional().describe("Data to save (for save op)"),
});

export const databaseTool = {
    name: "database_tool",
    description: "Query and save flashcards to the local database.",
    inputSchema: {
        type: "object",
        properties: {
            operation: { type: "string", enum: ["query", "save"], description: "Operation to perform" },
            collection: { type: "string", description: "Collection to operate on" },
            query: { type: "object", description: "Query filter (for query op)" },
            data: { type: "object", description: "Data to save (for save op)" }
        },
        required: ["operation", "collection"]
    },
    async execute(input: unknown) {
        const args = DatabaseInputSchema.parse(input);
        const { operation, query, data } = args;

        // Ensure DB dir exists
        await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

        let db: any[] = [];
        try {
            const content = await fs.readFile(DB_PATH, 'utf-8');
            db = JSON.parse(content);
        } catch (e) {
            // New DB
        }

        switch (operation) {
            case "query":
                // Simple filter implementation
                if (!query || Object.keys(query).length === 0) {
                    return { success: true, results: db };
                }
                const results = db.filter(item => {
                    return Object.entries(query).every(([k, v]) => item[k] === v);
                });
                return { success: true, results };

            case "save":
                if (!data) throw new Error("Data required for save");
                db.push(data);
                await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
                return { success: true, id: data.id || db.length };

            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
};
