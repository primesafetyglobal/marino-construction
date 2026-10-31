// SEARCH SELECT (flow): the shape of a suggestion, declared by hand (DNSA ch. 11).

export type SearchKind = "equipment" | "product" | "service" | "training";

export type SearchSuggestion = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  external: boolean;
};

export type SearchResult = { q: string; items: SearchSuggestion[] };
