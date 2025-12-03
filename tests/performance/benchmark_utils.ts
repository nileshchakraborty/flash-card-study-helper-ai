/**
 * Performance Benchmark Utilities
 * Helpers for timing, statistics, and result formatting
 */

export interface BenchmarkResult {
    operation: string;
    iterations: number;
    times: number[];
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
    throughput: number;
}

export interface ComparisonResult {
    operation: string;
    rest: BenchmarkResult;
    graphql: BenchmarkResult;
    winner: 'REST' | 'GraphQL' | 'Tie';
    improvement: string;
}

/**
 * High-precision timer for benchmarking
 */
export class PrecisionTimer {
    private start: [number, number] | null = null;

    begin(): void {
        this.start = process.hrtime();
    }

    end(): number {
        if (!this.start) {
            throw new Error('Timer not started');
        }
        const [seconds, nanoseconds] = process.hrtime(this.start);
        this.start = null;
        return seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
    }
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
    const index = Math.ceil((sorted.length * p) / 100) - 1;
    return sorted[Math.max(0, index)];
}

/**
 * Calculate statistics from timing data
 */
export function calculateStats(times: number[]): {
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
} {
    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);

    return {
        avg: sum / times.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
    };
}

/**
 * Run benchmark iterations
 */
export async function benchmark(
    operation: string,
    fn: () => Promise<any>,
    iterations: number = 100,
    warmup: number = 10
): Promise<BenchmarkResult> {
    // Warm-up phase
    for (let i = 0; i < warmup; i++) {
        await fn();
    }

    // Actual benchmark
    const times: number[] = [];
    const timer = new PrecisionTimer();

    const startTime = Date.now();
    for (let i = 0; i < iterations; i++) {
        timer.begin();
        await fn();
        times.push(timer.end());
    }
    const totalTime = (Date.now() - startTime) / 1000; // seconds

    const stats = calculateStats(times);

    return {
        operation,
        iterations,
        times,
        ...stats,
        throughput: iterations / totalTime, // requests per second
    };
}

/**
 * Compare two benchmark results
 */
export function compareResults(
    operation: string,
    rest: BenchmarkResult,
    graphql: BenchmarkResult
): ComparisonResult {
    const diff = ((rest.avg - graphql.avg) / rest.avg) * 100;

    let winner: 'REST' | 'GraphQL' | 'Tie';
    let improvement: string;

    if (Math.abs(diff) < 5) {
        winner = 'Tie';
        improvement = 'Similar performance';
    } else if (diff > 0) {
        winner = 'GraphQL';
        improvement = `${diff.toFixed(1)}% faster`;
    } else {
        winner = 'REST';
        improvement = `${Math.abs(diff).toFixed(1)}% faster`;
    }

    return {
        operation,
        rest,
        graphql,
        winner,
        improvement,
    };
}

/**
 * Format results as table
 */
export function formatResultsTable(comparisons: ComparisonResult[]): string {
    const header = '| Operation | REST (avg) | GraphQL (avg) | Winner | Improvement |';
    const separator = '|-----------|------------|---------------|--------|-------------|';

    const rows = comparisons.map(c => {
        return `| ${c.operation} | ${c.rest.avg.toFixed(2)}ms | ${c.graphql.avg.toFixed(2)}ms | ${c.winner} | ${c.improvement} |`;
    });

    return [header, separator, ...rows].join('\n');
}

/**
 * Format detailed results
 */
export function formatDetailedResults(result: BenchmarkResult): string {
    return `
${result.operation}:
  Iterations: ${result.iterations}
  Average:    ${result.avg.toFixed(2)}ms
  Min:        ${result.min.toFixed(2)}ms
  Max:        ${result.max.toFixed(2)}ms
  P50:        ${result.p50.toFixed(2)}ms
  P95:        ${result.p95.toFixed(2)}ms
  P99:        ${result.p99.toFixed(2)}ms
  Throughput: ${result.throughput.toFixed(2)} req/s
  `.trim();
}

/**
 * Log comparison results
 */
export function logComparison(comparison: ComparisonResult): void {
    console.log('\n' + '='.repeat(60));
    console.log(`📊 ${comparison.operation}`);
    console.log('='.repeat(60));
    console.log('\nREST API:');
    console.log(formatDetailedResults(comparison.rest));
    console.log('\nGraphQL API:');
    console.log(formatDetailedResults(comparison.graphql));
    console.log(`\n🏆 Winner: ${comparison.winner} (${comparison.improvement})`);
    console.log('='.repeat(60) + '\n');
}
