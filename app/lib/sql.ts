import * as vercel_postgres from "@vercel/postgres";

export const DEBUG = false;

function prepareTemplateString(stringArray: TemplateStringsArray, ...values: any[]) {
    const resulting_string_array : string[] = [];
    stringArray.forEach((template_part, index) => {
        resulting_string_array.push(template_part);
        if (index < values.length) {
            const value = values[index];
            const value_as_string = `${value}`;

            // Escape any inner single-quotes with backslash and wrap the whole thing in single-quotes
            const escaped = `'${value_as_string.replaceAll("'", "\'")}'`
            resulting_string_array.push(escaped);
        }
    })
    return resulting_string_array.join('');
}

export const sql: typeof vercel_postgres.sql = new Proxy(vercel_postgres.sql, {
    apply(target, thisArg, argArray) {
        const preparedStatement = prepareTemplateString(...argArray);
        if (DEBUG) console.log(`Applying SQL on ${preparedStatement}`);
        return Reflect.apply(target, thisArg, argArray);
    },
})

export async function query<ResultType extends vercel_postgres.QueryResultRow>(rawQuery: string): Promise<vercel_postgres.QueryResult<ResultType>> {
    if (DEBUG) console.log(`Applying SQL on ${rawQuery}`);
    return vercel_postgres.sql.query<ResultType>(rawQuery)
}