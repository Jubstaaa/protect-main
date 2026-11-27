export function createClient(token) {
    return async function gh(path, init) {
        const response = await fetch(`https://api.github.com${path}`, {
            ...init,
            headers: {
                'accept': 'application/vnd.github+json',
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'x-github-api-version': '2022-11-28',
            },
        })
        if (!response.ok) {
            throw new Error(
                `${init?.method ?? 'GET'} ${path} -> ${response.status} ${await response.text()}`
            )
        }

        return response.status === 204 ? null : response.json()
    }
}
