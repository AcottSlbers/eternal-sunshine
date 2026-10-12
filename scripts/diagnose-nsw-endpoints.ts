import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { providerFetch } from "../lib/providers/http-cache";
import { FEED_URLS } from "../lib/providers/official-webcam-provider";
import { array, record, string } from "../lib/providers/normalize";

async function main() {
  const output = process.argv.find(a => a.startsWith("--output="))?.slice(9);
  if (!output?.startsWith("docs/phase-3.7b-nsw-")) throw new Error("Provide a NEW docs/phase-3.7b-nsw-*.json output");
  try { await readFile(output); throw new Error("Output exists; refusing to overwrite"); }
  catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const saved = process.argv.find(a => a.startsWith("--metadata="))?.slice(11);
  const raw = saved ? JSON.parse(await readFile(saved, "utf8")) : await (await providerFetch("nsw", FEED_URLS.nsw)).json();
  const features = array(record(raw).features);
  const propertyFields = [...new Set(features.flatMap(f => Object.keys(record(record(f).properties))))].sort();
  const regions = ["SYD_SOUTH", "SYD_MET", "REG_NORTH", "REG_SOUTH", "REG_WEST"];
  const observations = [];
  for (const region of regions) {
    const f = record(features.find(f => record(record(f).properties).region === region));
    const p = record(f.properties); const href = string(p.href);
    if (!href) continue;
    const result: Record<string, unknown> = { id: f.id, region, title: p.title, requestedUrl: href };
    try {
      let current = href; const redirects: string[] = [];
      let response: Response | undefined;
      for (let hop = 0; hop <= 3; hop++) {
        const target = new URL(current);
        if (target.protocol !== "https:" || target.hostname !== "webcams.transport.nsw.gov.au" || target.username || target.password)
          throw new Error("Redirect/URL outside documented NSW webcam host");
        response = await providerFetch("nsw", current, { redirect: "manual" });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get("location");
        if (!location || hop === 3) throw new Error("Unresolved redirect");
        current = new URL(location, current).href; redirects.push(current);
      }
      if (!response) throw new Error("No response");
      const reader = response.body?.getReader(); if (!reader) throw new Error("Empty response");
      const chunks: Uint8Array[] = []; let bytes = 0;
      while (true) {
        const part = await reader.read(); if (part.done) break;
        bytes += part.value.length;
        if (bytes > 8 * 1024 * 1024) { await reader.cancel(); throw new Error("Response exceeds 8 MB"); }
        chunks.push(part.value);
      }
      const buffer = Buffer.concat(chunks); const contentType = response.headers.get("content-type") ?? "";
      const magic = buffer.subarray(0, 16).toString("hex");
      const hasImageMagic = magic.startsWith("ffd8ff") || magic.startsWith("89504e470d0a1a0a") || magic.startsWith("47494638")
        || (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP");
      const text = hasImageMagic ? "" : buffer.subarray(0, 2048).toString("utf8");
      let classification = /<html|<!doctype/i.test(text) ? /unavailable|page not found/i.test(text) ? "HTML unavailable placeholder" : "other HTML"
        : hasImageMagic ? contentType.startsWith("image/") ? "real image" : "image with unexpected content-type"
          : contentType.startsWith("text/") ? "text response" : "other";
      let decoded = false; let resolution: string | undefined;
      if (hasImageMagic) {
        const metadata = await sharp(buffer, { limitInputPixels: 25_000_000 }).metadata();
        decoded = true; resolution = `${metadata.width}x${metadata.height}`;
        if (!contentType.startsWith("image/")) classification = "image with unexpected content-type";
      }
      Object.assign(result, { status: response.status, contentType, finalUrl: response.url || current, redirects, bytes, magic,
        classification, decoded, resolution, lastModified: response.headers.get("last-modified"),
        placeholderExcerpt: classification.includes("HTML") ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) : undefined });
    } catch (error) { Object.assign(result, { classification: "other", error: error instanceof Error ? error.message : "Request failed" }); }
    observations.push(result);
  }
  await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), feedCount: features.length, propertyFields,
    alternativeStructuredImageField: null, observations }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(observations));
}
void main().catch(error => { console.error(error instanceof Error ? error.message : "Diagnosis failed"); process.exitCode = 1; });
