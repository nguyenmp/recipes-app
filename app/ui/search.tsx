"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";

const QUERY_KEY = 'query';

export function SearchBar() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set(QUERY_KEY, term);
        } else {
            params.delete(QUERY_KEY);
        }
        replace(`${pathname}?${params.toString()}`)
    }, 300);

    return (
        <form className="flex flex-row">
            {Array.from(searchParams).filter(([key, value]) => key != 'query').map(([key, value], index) => {
                return <input key={index} type="text" name={key} hidden={true} defaultValue={value} />
            })}
            <input type="text" name="query" className="flex-grow border-4 m-2 p-2" defaultValue={searchParams.get(QUERY_KEY)?.toString()} onChange={(event) => handleSearch(event.target.value)} placeholder="Search here..."/>
            <input type="submit" className="m-2 p-2 bg-red-200" value="Search" />
        </form>
    );
}