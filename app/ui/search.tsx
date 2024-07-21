"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

const QUERY_KEY = 'query';

export function SearchBar() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    function handleSearch(term: string) {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set(QUERY_KEY, term);
        } else {
            params.delete(QUERY_KEY);
        }
        replace(`${pathname}?${params.toString()}`)
    }

    return (
        <form className="flex flex-row">
            <input type="text" name="query" className="flex-grow border-4 m-2 p-2" defaultValue={searchParams.get(QUERY_KEY)?.toString()} onChange={(event) => handleSearch(event.target.value)} placeholder="Search here..."/>
            <input type="submit" className="m-2 p-2 bg-red-200" value="Search" />
        </form>
    );
}