# Standardized API Contract: Job Results

## 1. Overview
This contract defines the strict data format for asynchronous job results in the MindFlip AI system. All background jobs must adhere to this standard to ensure consistent frontend-backend communication.

**Effective Date**: 2025-12-08
**Status**: ACTIVE

## 2. The "One Format" Rule
All asynchronous jobs (e.g., Flashcard Generation) MUST return results as a **parsed JSON Object**.
- Strings (stringified JSON) are **FORBIDDEN** as the final result payload.
- Mixed Types (arrays vs objects) are **FORBIDDEN**.

## 3. Job Status Endpoint
`GET /api/jobs/:id`

### Response Schema (Completed)
```json
{
  "status": "completed",
  "progress": 100,
  "result": {
    "cards": [
      {
        "id": "string",
        "front": "string",
        "back": "string",
        "topic": "string"
      }
    ],
    "recommendedTopics": ["string"] // Optional
  }
}
```

### Critical Constraints
1. **`result` Field**: Must be an **Object**.
   - ✅ Correct: `"result": { "cards": [...] }`
   - ❌ Incorrect: `"result": "[{\"front\":...}]"` (Stringified)
   - ❌ Incorrect: `"result": [...]` (Direct Array)

2. **`cards` Property**: The core data must be nested under a `cards` property. This allows for future extensibility (e.g., adding metadata, stats) without breaking the contract.

## 4. Implementation Responsibilities

### Backend (`QueueService`)
- Must ensure that any data retrieved from storage (e.g., Redis) is **deserialized** before being returned to the API layer.
- Must wrap any raw array results into the standard object format `{ cards: [...] }` if legacy jobs exist (though they should be updated).

### Frontend (`AppController`)
- Must expect `jobResult.cards`.
- Should throw a clear error if the format is violated (e.g., `expected { cards: [] }`), rather than attempting to silently patch or guess the format.

## 5. Versioning
Any change to this structure requires a version bump and updates to both Backend `QueueService` and Frontend `AppController`.
