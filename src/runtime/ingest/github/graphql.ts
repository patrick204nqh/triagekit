export async function ghGraphQL<T = any>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; errors?: { message: string }[] }> {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`graphql ${response.status}`);
  return response.json();
}
