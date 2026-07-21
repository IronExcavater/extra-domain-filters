export async function copyText(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
}
