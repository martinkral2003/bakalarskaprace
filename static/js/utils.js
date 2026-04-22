export function isEditableTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
    );
}
