const ENDPOINT = "https://query.wikidata.org/sparql";
const QUERY = `
  SELECT ?filmLabel WHERE {
    ?film wdt:P31 wd:Q11424 .
    SERVICE wikibase:label {
      bd:serviceParam wikibase:language "es" .
    }
    FILTER(LANG(?filmLabel) = "es")
  }
  LIMIT 50
`;

let movieTitlesPromise;

async function fetchMovieTitles() {
  const url = new URL(ENDPOINT);
  url.searchParams.set("query", QUERY);
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La búsqueda tardó demasiado. Inténtalo de nuevo.");
    }

    throw new Error("No pudimos conectar con Wikidata. Comprueba tu conexión.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error("Wikidata no está disponible en este momento.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Wikidata devolvió una respuesta inválida.");
  }

  const bindings = data?.results?.bindings;
  if (!Array.isArray(bindings)) {
    throw new Error("Wikidata devolvió una respuesta inválida.");
  }

  const titles = bindings
    .map((binding) => binding?.filmLabel?.value)
    .filter((title) => typeof title === "string" && title.trim());

  if (!titles?.length) {
    throw new Error("Wikidata no devolvió títulos de películas.");
  }

  return titles;
}

export async function fetchRandomMovieTitle() {
  movieTitlesPromise ??= fetchMovieTitles().catch((error) => {
    movieTitlesPromise = undefined;
    throw error;
  });

  const titles = await movieTitlesPromise;
  return titles[Math.floor(Math.random() * titles.length)];
}
