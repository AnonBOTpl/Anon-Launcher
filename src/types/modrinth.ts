/** A single mod from the Modrinth search results */
export interface ModrinthSearchHit {
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side: "required" | "optional" | "unsupported" | "unknown";
  server_side: "required" | "optional" | "unsupported" | "unknown";
  project_type: string;
  downloads: number;
  icon_url: string | null;
  project_id: string;
  author: string;
  versions: string[];
  follows: number;
  date_created: string;
  date_modified: string;
  latest_version: string;
  license: string;
  gallery: string[];
  color: number | null;
}

/** Search response from Modrinth */
export interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

/** Full project details */
export interface ModrinthProject {
  slug: string;
  title: string;
  description: string;
  body: string;
  body_url: string | null;
  project_type: string;
  categories: string[];
  loaders: string[];
  game_versions: string[];
  client_side: "required" | "optional" | "unsupported" | "unknown";
  server_side: "required" | "optional" | "unsupported" | "unknown";
  downloads: number;
  followers: number;
  icon_url: string | null;
  author: string;
  license: {
    id: string;
    name: string;
    url: string | null;
  };
  versions: string[];
  latest_version: string | null;
  date_created: string;
  date_modified: string;
  source_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  gallery: Array<{
    url: string;
    featured: boolean;
    title: string | null;
    description: string | null;
    created: string;
  }>;
}

/** A version of a mod */
export interface ModrinthVersion {
  id: string;
  project_id: string;
  author_id: string;
  featured: boolean;
  name: string;
  version_number: string;
  changelog: string;
  changelog_url: string | null;
  date_published: string;
  downloads: number;
  version_type: "release" | "beta" | "alpha";
  status: "listed" | "archived" | "draft" | "unlisted" | "scheduled" | "unknown";
  loaders: string[];
  game_versions: string[];
  files: Array<{
    url: string;
    filename: string;
    size: number;
    hashes: {
      sha1: string;
      sha512: string;
    };
    primary: boolean;
  }>;
  dependencies: Array<{
    version_id: string | null;
    project_id: string | null;
    file_name: string | null;
    dependency_type: "required" | "optional" | "incompatible" | "embedded";
  }>;
}

/** Search sort options */
export type ModrinthSortIndex = "relevance" | "downloads" | "follows" | "newest" | "updated";
