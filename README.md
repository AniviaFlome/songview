# Song View

A beautiful, modern web-based viewer for Spotify playlist and osu! beatmap exports. Works with CSV files exported from [Exportify](https://exportify.app/) and [osu! Beatmap Manager](https://github.com/Piotrekol/osu-beatmap-manager).

## Usage

1. Export your Spotify playlist or osu! collection to CSV
2. Open [Song View](https://song-view.pages.dev) or host it locally
3. Drag and drop your CSV file onto the page
4. Explore your library!

## Supported CSV Formats

### [Exportify](https://github.com/watsonbox/exportify)

Standard Exportify CSV with columns: Track Name, Artist Name(s), Album Name, etc.

### [osu-beatmap-manager](https://github.com/AniviaFlome/osu-beatmap-manager)

CSV with columns: Collection, Artist, Title, Difficulty, StarRating, BPM, Length, Ruleset, Status, BeatmapID, BeatmapSetID, DownloadLink, PreviewLink

### Local Development

```bash
python3 -m http.server 8000
# or
npx serve .
```
