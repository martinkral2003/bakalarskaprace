export function getJSON(url) {
    return fetch(url).then((response) => response.json());
}

export function postJSON(url, payload) {
    return fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
    });
}
