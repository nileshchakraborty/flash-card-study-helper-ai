
function extractJSON(text) {
    // 1. Clean the text
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    // Find the outer array brackets
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');

    if (firstBracket >= 0 && lastBracket > firstBracket) {
        const candidate = cleaned.substring(firstBracket, lastBracket + 1);
        try {
            const result = JSON.parse(candidate);
            return result;
        } catch (e) {
            console.log("Bracket extraction failed:", e.message);
        }
    }

    // 3. Regex Fallback
    const cards = [];

    // Regex to capture {"question": "...", "answer": "..."} patterns
    const objectRegex = /\{\s*"question"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"answer"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

    let match;
    while ((match = objectRegex.exec(text)) !== null) {
        try {
            const question = JSON.parse(`"${match[1]}"`);
            const answer = JSON.parse(`"${match[2]}"`);
            cards.push({ question, answer });
        } catch (e) {
            cards.push({ question: match[1], answer: match[2] });
        }
    }

    if (cards.length > 0) {
        return cards;
    }

    return [];
}

const testCases = [
    `Here is the JSON:
    [
        {"question": "Q1", "answer": "A1"},
        {"question": "Q2", "answer": "A2"}
    ]`,
    `[{"question": "Q1", "answer": "A1"}] with trailing text`,
    `Prefix text [{"question": "Q1", "answer": "A1"}]`,
    `
    {
        "question": "Q1",
        "answer": "A1"
    }
    {
        "question": "Q2",
        "answer": "A2"
    }
    `,
    `[
        {
            "question": "Multiline \n Question",
            "answer": "Multiline \n Answer"
        }
    ]`,
    // Malformed cases
    `[
        { "question": "Missing quotes", "answer": "A1" },
    ]`, // Trailing comma
    // Text format case
    `Here are 10 flashcards:
    
    [Card 1]
    Question: What is Java?
    Answer: A programming language.
    
    [Card 2]
    Question: What is a thread?
    Answer: A unit of execution.
    `,
    // Bold format case
    `Here are 10 flashcards:
    
    1. **Card:** What is the Java Collections Framework?
    **Answer:** A set of classes and interfaces that provide data structures.
    
    2. **Card:** What does interoperability mean?
    **Answer:** The ability of these collections to work seamlessly.
    `
];

testCases.forEach((test, i) => {
    console.log(`--- Test Case ${i + 1} ---`);
    const result = extractJSON(test);
    console.log("Result length:", result.length);
    console.log(JSON.stringify(result, null, 2));
});
