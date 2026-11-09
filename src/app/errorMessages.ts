export const SERVER_UNAVAILABLE_MESSAGE =
  "Serviço temporariamente indisponível. Tente novamente mais tarde.";

export const NETWORK_UNAVAILABLE_MESSAGE =
  "Não foi possível conectar ao servidor. Tente novamente mais tarde.";

export async function fetchWithFriendlyNetworkError(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(NETWORK_UNAVAILABLE_MESSAGE);
  }
}
