import * as vercel_postgres from "@vercel/postgres";
import { Pool, QueryConfigValues, QueryResult, QueryResultRow } from 'pg';

// Specifically don't export our connection so that all SQL must
// go through the methods below and get logged during debug mode
const connectionPool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: 5432,
});

const DEBUG = false;

function prepareTemplateStringAsString(stringArray: TemplateStringsArray, ...values: any[]) {
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

function prepareTemplateStringAsStatement(stringArray: TemplateStringsArray, ...values: any[]): {templateQuery: string, values: QueryConfigValues<any[]>} {
    values = values[0]; // Not sure why this works -shrug-
    const resulting_string_array : string[] = [];
    const resulting_value_array : any[] = []
    stringArray.forEach((template_part, index) => {
        resulting_string_array.push(template_part);
        if (index < values.length) {
            // Replace any gaps with $1, $2, $3, etc
            resulting_string_array.push(`$${index + 1}`);
            resulting_value_array.push(values[index])
        }
    })

    const templateQuery = resulting_string_array.join('')
    return {
        templateQuery,
        values: resulting_value_array,
    };
}

export const sql: typeof vercel_postgres.sql = new Proxy(vercel_postgres.sql, {
    apply(target, thisArg, argArray) {
        // @ts-ignore
        const preparedStatementString = prepareTemplateStringAsString(...argArray);
        if (DEBUG) console.log(`Applying SQL on ${preparedStatementString}`);
        const preparedStatement = prepareTemplateStringAsStatement(argArray[0], argArray.slice(1));
        return query(preparedStatement.templateQuery, preparedStatement.values);
    },
})

export async function query<ResultType extends QueryResultRow>(rawQuery: string, values? : QueryConfigValues<any[]>): Promise<QueryResult<ResultType>> {
    if (DEBUG) console.log(`Applying SQL on ${rawQuery} with ${JSON.stringify(values)}`);
    return connectionPool.query(rawQuery, values);
}