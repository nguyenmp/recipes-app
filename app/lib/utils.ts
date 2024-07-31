export function withTiming<T>(lable: string, callable: () => T): T {
    console.log(`starting: ${lable}`);
    performance.mark(`start: ${lable}`);
    const result = callable();
    performance.mark(`stop: ${lable}`);
    console.log(performance.measure(`measure: ${lable}`, `start: ${lable}`, `stop: ${lable}`));
    return result;
}

export async function withTimingAsync<T>(lable: string, callable: () => Promise<T>): Promise<T> {
    console.log(`starting: ${lable}`);
    performance.mark(`start: ${lable}`);
    const result = await callable();
    performance.mark(`stop: ${lable}`);
    console.log(performance.measure(`measure: ${lable}`, `start: ${lable}`, `stop: ${lable}`));
    return result;
}