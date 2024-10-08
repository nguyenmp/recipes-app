
import showdown from "showdown";


export function MarkdownPreview(params: { content_markdown?: string }) {
    const html_string = new showdown.Converter({ simplifiedAutoLink: true }).makeHtml(params.content_markdown || '');

    {/* In Tailwind CSS, how to style elements while using dangerouslySetInnerHTML in ReactJS?
        https://stackoverflow.com/questions/74518155/in-tailwind-css-how-to-style-elements-while-using-dangerouslysetinnerhtml-in-re
        https://stackoverflow.com/questions/69276276/why-tailwind-list-style-type-is-not-working
        Also note that most styling for elements from markdown are in globals.css under the markdown-container class */}
    return <div>
        <div className="markdown-container" dangerouslySetInnerHTML={{ __html: html_string }}></div>
    </div>

}
