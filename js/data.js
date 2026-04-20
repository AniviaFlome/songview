import { state } from "./state.js";
import { renderData, showViewer, updateStats } from "./ui.js";
import { parseCSVLine, parseLengthToSeconds } from "./utils.js";

function isOsuKeys(keys) {
  const lower = keys.map((k) => k.toLowerCase());
  return (
    lower.includes("beatmapid") ||
    lower.includes("beatmapsetid") ||
    lower.includes("difficulty") ||
    lower.includes("difficulty count") ||
    lower.includes("md5")
  );
}

export function detectDataFormat(data) {
  if (!data || data.length === 0) return "spotify";
  return isOsuKeys(Object.keys(data[0])) ? "osu" : "spotify";
}

const RULESET_MAP = {
  osu: "osu!",
  taiko: "osu!taiko",
  fruits: "osu!catch",
  mania: "osu!mania",
};

function normalizeRuleset(val) {
  if (!val) return "";
  const lower = String(val).toLowerCase().trim();
  return RULESET_MAP[lower] || val;
}

function normalizeStatus(val) {
  if (!val) return "";
  return String(val)
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function transformOsuData(rawRows) {
  const groups = {};
  const headers = Object.keys(rawRows[0] || {});
  const hasStarRating = headers.includes("StarRating");

  for (const row of rawRows) {
    const setId = row.BeatmapSetID;
    const key =
      setId && setId !== "-1" && setId.trim() !== ""
        ? setId
        : `${row.Artist}||${row.Title}`;

    if (!groups[key]) {
      groups[key] = {
        title: row.Title,
        artist: row.Artist,
        setId: setId,
        downloadLink: row.DownloadLink || "",
        previewLink: row.PreviewLink || "",
        bpm: row.BPM || "",
        length: row.Length || "",
        ruleset: row.Ruleset || "",
        status: row.Status || "",
        collections: new Set(),
        difficulties: [],
        starRatings: [],
      };
    }

    if (row.Collection?.trim()) {
      groups[key].collections.add(row.Collection);
    }
    if (row.Difficulty?.trim()) {
      groups[key].difficulties.push(row.Difficulty);
      if (hasStarRating && row.StarRating) {
        groups[key].starRatings.push(parseFloat(row.StarRating) || 0);
      } else {
        groups[key].starRatings.push(0);
      }
    }
  }

  return Object.values(groups).map((group, index) => {
    const gSetId =
      group.setId && group.setId !== "-1" && group.setId.trim() !== ""
        ? group.setId
        : "";
    const diffEntries = group.difficulties.map((name, i) => {
      const stars = group.starRatings[i] || 0;
      return stars > 0 ? `${name}::${stars.toFixed(2)}` : name;
    });
    const previewUrl =
      group.previewLink ||
      (gSetId ? `https://b.ppy.sh/preview/${gSetId}.mp3` : "");
    return {
      Title: group.title,
      Artist: group.artist,
      Collection: [...group.collections].join(", ") || "None",
      "Difficulty Count": String(group.difficulties.length),
      Difficulties: diffEntries.join("||"),
      BeatmapSetID: gSetId || "",
      DownloadLink: group.downloadLink,
      BPM: group.bpm,
      Length: group.length,
      Ruleset: normalizeRuleset(group.ruleset),
      Status: normalizeStatus(group.status),
      ImageURL: gSetId ? `https://b.ppy.sh/thumb/${gSetId}l.jpg` : "",
      PreviewURL: previewUrl,
      _index: index,
    };
  });
}

export function processCSVData(csvText) {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return null;

  const headers = parseCSVLine(lines[0]);
  const rawRows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rawRows.push(row);
    }
  }

  const format = isOsuKeys(headers) ? "osu" : "spotify";
  let data, finalHeaders;

  if (format === "osu") {
    data = transformOsuData(rawRows);
    finalHeaders = data.length > 0 ? Object.keys(data[0]) : headers;
  } else {
    data = rawRows;
    finalHeaders = headers;
  }

  return { data, headers: finalHeaders, format };
}

export function parseCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = processCSVData(e.target.result);
    if (!result) return;

    state.headers = result.headers;
    state.data = result.data;
    state.filteredData = [...state.data];
    state.currentPage = 1;
    state.format = result.format;

    showViewer();
  };
  reader.readAsText(file);
}

export function handleSearch(e) {
  state.searchQuery = e.target.value.toLowerCase();
  applyFilters();
}

export function applyFilters() {
  state.currentPage = 1;

  state.filteredData = state.data.filter((row) => {
    if (state.modeFilter && row.Ruleset !== state.modeFilter) return false;
    if (state.statusFilter && row.Status !== state.statusFilter) return false;
    if (state.searchQuery) {
      return Object.values(row).some((value) =>
        String(value).toLowerCase().includes(state.searchQuery),
      );
    }
    return true;
  });

  if (state.sortColumn) {
    handleSort(state.sortColumn);
  } else {
    updateStats();
    renderData();
  }
}

export function handleSort(column) {
  if (state.sortColumn === column) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortColumn = column;
    // Keep current direction when switching columns, default to desc on first sort
    if (!state.sortDirection) state.sortDirection = "desc";
  }

  state.filteredData.sort((a, b) => {
    let valA = a[column];
    let valB = b[column];

    // Handle null/undefined
    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";

    // Numeric sort for specific fields
    if (
      column.toLowerCase().includes("popularity") ||
      column.toLowerCase().includes("duration") ||
      column.toLowerCase() === "disc number" ||
      column.toLowerCase() === "track number" ||
      column.toLowerCase() === "difficulty count" ||
      column.toLowerCase() === "beatmapsetid" ||
      column.toLowerCase() === "bpm" ||
      column.toLowerCase() === "_index"
    ) {
      valA = parseInt(valA, 10);
      valB = parseInt(valB, 10);

      // Handle NaN (treat as 0)
      if (Number.isNaN(valA)) valA = 0;
      if (Number.isNaN(valB)) valB = 0;
    } else if (column.toLowerCase() === "length") {
      valA = parseLengthToSeconds(valA);
      valB = parseLengthToSeconds(valB);
    } else if (
      column.toLowerCase().includes("added") ||
      column.toLowerCase().includes("date") ||
      column.toLowerCase().includes("release")
    ) {
      // Date sorting
      valA = new Date(valA).getTime() || 0;
      valB = new Date(valB).getTime() || 0;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }

    if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Trigger render (circular dep handled by main or ui usually, but here calling renderData from ui via import would be circular)
  // In strict modules, we return the sorted data or dispatch an event.
  // Since we modifying state in place, UI just needs to re-render.
  // We will dispatch a custom event or let the UI caller handle re-render.
  // Assuming UI imports this, we can't import UI to call renderData.
  // Solution: Dispatch event on window or use callback.
  // Ideally main.js sets this up, but for now we'll trigger a custom event.
  window.dispatchEvent(new CustomEvent("dataSorted"));
}

export function getDisplayHeaders() {
  if (state.format === "osu") {
    const priority = ["Title", "BPM", "Length"];
    const displayed = [];

    priority.forEach((p) => {
      const found = state.headers.find(
        (h) => h.toLowerCase() === p.toLowerCase(),
      );
      if (found) displayed.push(found);
    });

    const excluded = [
      "difficulties",
      "md5",
      "beatmapid",
      "beatmapsetid",
      "downloadlink",
      "imageurl",
      "previewurl",
      "previewlink",
      "star_rating",
      "starrating",
      "cs",
      "ar",
      "od",
      "hp",
      "status",
      "ruleset",
      "collection",
      "artist",
      "difficulty count",
      "_index",
    ];

    state.headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (
        !displayed.includes(h) &&
        displayed.length < 5 &&
        !excluded.includes(lower) &&
        !lower.includes("uri") &&
        !lower.includes("url")
      ) {
        displayed.push(h);
      }
    });

    return displayed;
  }

  // Only show these specific columns in order
  const priority = [
    "Track Name",
    "Album Name",
    "Track Duration (ms)",
    "Popularity",
  ];
  const displayed = [];

  priority.forEach((p) => {
    const found = state.headers.find(
      (h) => h.toLowerCase() === p.toLowerCase(),
    );
    if (found) displayed.push(found);
  });

  // Explicitly exclude these columns - they clutter the table
  const excluded = [
    "added at",
    "added by",
    "artist name(s)",
    "artist name",
    "artists",
    "artist",
    "album artist name(s)",
    "album artist name",
    "album artists",
    "album release date",
    "release date",
    "disc number",
    "track number",
    "isrc",
    "spotify id",
    "explicit",
    "explicit?",
  ];

  // Add remaining headers up to limit, excluding unwanted ones
  state.headers.forEach((h) => {
    const lower = h.toLowerCase();
    if (
      !displayed.includes(h) &&
      displayed.length < 5 &&
      !excluded.includes(lower) &&
      !lower.includes("image") &&
      !lower.includes("uri") &&
      !lower.includes("url")
    ) {
      displayed.push(h);
    }
  });

  return displayed;
}

// Get a cleaner display name for headers
export function getDisplayName(header) {
  const names = {
    "Track Duration (ms)": "Duration",
    "Artist Name(s)": "Artist",
    "Album Name": "Album",
    Title: "Map",
    "Difficulty Count": "Diffs",
    BeatmapSetID: "Set ID",
    Collection: "Collection",
    BPM: "BPM",
    Length: "Length",
    Ruleset: "Mode",
    Status: "Status",
  };
  return names[header] || header;
}

export function findHeader(possibleNames) {
  return state.headers.find((h) =>
    possibleNames.some((name) => h.toLowerCase() === name.toLowerCase()),
  );
}
