#!/usr/bin/env node

/**
 * Generate guide illustrations using NanoBanana (Gemini Imagen)
 * Usage: GEMINI_API_KEY="..." node scripts/generate-guide-images.mjs [guide-slug]
 *
 * Generates images locally, then upload to R2 with:
 *   npx wrangler r2 object put church-assets/guides/<guide>/<name>.png --file <local-path>
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY (found in /Users/dpr/Desktop/Egna Appar/Projekt/.env.shared)");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const imageModel = genAI.getGenerativeModel({ model: "nano-banana-pro-preview" });

const STYLE_PREFIX = `Detailed scene-based line art illustration. Uniform medium-gray outlines on warm off-white background (#fdf8f4). Subtle warm linen-toned fills for depth. Single accent color rose-gold (#b06a50) used sparingly on 1-2 key details. Clean vector style, slightly rounded corners. Characters have simple but expressive faces (dot eyes, curved smile), casual clothes with minimal detail. Warm friendly approachable mood. No text in image. Landscape format.`;

const guides = {
  "first-visit": [
    { name: "01-parking-lot", prompt: `${STYLE_PREFIX} Scene: A person sitting in their car in a church parking lot, hands resting on the steering wheel, looking through the windshield at a warm welcoming church building ahead. Small charming details: a coffee cup in the cupholder, morning sunlight, a few other cars. Rose-gold accent on the church door handle.` },
    { name: "02-walking-in", prompt: `${STYLE_PREFIX} Scene: A person walking toward glass double doors of a church, warm golden light glowing from inside. A small welcome sign by the entrance. Autumn leaves on the ground. Rose-gold accent on the warm light streaming out.` },
    { name: "03-lobby", prompt: `${STYLE_PREFIX} Scene: A church lobby with a coffee station, a friendly greeter waving hello, a table with bulletins. Cozy and inviting, not grand or intimidating. People chatting casually. Rose-gold accent on the coffee cup.` },
    { name: "04-finding-seat", prompt: `${STYLE_PREFIX} Scene: View from the back of a church auditorium, rows of modern chairs, one person settling into a back-row aisle seat. Stage visible in the distance with soft lighting. Rose-gold accent on the person's bag on the chair.` },
    { name: "05-worship-wide", prompt: `${STYLE_PREFIX} Scene: A worship band on stage seen from behind the congregation. People standing, some with hands gently raised, lyrics on a screen. Soft stage lights. Emotional and warm. Rose-gold accent on a guitar. Wide panoramic composition.` },
    { name: "06-sermon", prompt: `${STYLE_PREFIX} Scene: A speaker at a simple wooden podium with an open book, warm stage lights, a few people in the audience taking notes on their phones. Relaxed atmosphere. Rose-gold accent on the podium light.` },
    { name: "07-after", prompt: `${STYLE_PREFIX} Scene: People leaving a church through open doors into sunlight, some chatting in small groups, one person walking alone to their car with a gentle wave. Peaceful mood. Rose-gold accent on the sunlight.` },
    { name: "08-kids", prompt: `${STYLE_PREFIX} Scene: A parent and small child at a colorful kids check-in counter, a friendly volunteer with a name tag, bright simple room with toys visible. Safe and fun atmosphere. Rose-gold accent on the child's backpack.` },
  ],

  "compare-traditional-vs-contemporary": [
    { name: "01-sound", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a church organ with hymn books on wooden pews. Right side shows electric guitars, drums, and a modern stage with screens. Both warm and inviting. Rose-gold accent on a hymnal bookmark (left) and guitar strap (right).` },
    { name: "02-room", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a traditional church interior with stone arches, stained glass, wooden pews. Right side shows a modern warehouse-style church with theater seating and stage lights. Rose-gold accent on a candle (left) and a stage light (right).` },
    { name: "03-people", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a well-dressed older congregation holding hymnals. Right side shows a casual mixed-age crowd with coffee cups, some in jeans. Rose-gold accent on a brooch (left) and coffee cup (right).` },
    { name: "04-sunday", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows people reading from a liturgy book, some kneeling. Right side shows people with hands raised, eyes closed, contemporary worship. Rose-gold accent on the book cover (left) and raised hand (right).` },
    { name: "05-feel", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows quiet reverence - people sitting in contemplation, light through stained glass. Right side shows energetic celebration - people smiling, clapping, lively atmosphere. Rose-gold accent on the stained glass light (left) and a smile (right).` },
  ],

  "compare-baptist-vs-pentecostal": [
    { name: "01-sound", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a choir in robes behind a pulpit, hymnals open. Right side shows an energetic worship team with drums, keyboard, and singers moving expressively. Rose-gold accent on a choir robe sash (left) and a tambourine (right).` },
    { name: "02-room", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a traditional Baptist church with a central pulpit, baptismal pool visible, wooden interior. Right side shows a Pentecostal church with open floor space, people moving freely, colorful banners. Rose-gold accent on the baptismal pool edge (left) and a banner (right).` },
    { name: "03-people", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a congregation sitting attentively, Bibles open, taking notes. Right side shows people standing, some dancing, some with hands raised high, emotional expressions. Rose-gold accent on an open Bible (left) and raised hands (right).` },
    { name: "04-sunday", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows structured service - hymn, prayer, sermon, invitation. Right side shows fluid service - extended worship, spontaneous prayer, altar ministry. Rose-gold accent on a bulletin program (left) and praying hands (right).` },
    { name: "05-feel", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows thoughtful study - people discussing Scripture in groups, intellectual warmth. Right side shows emotional experience - people being prayed over, tears of joy, group embrace. Rose-gold accent on an open notebook (left) and interlocked hands (right).` },
  ],

  "compare-liturgical-vs-free": [
    { name: "01-sound", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a cantor or priest chanting from a lectern, incense rising, a pipe organ. Right side shows a casual worship leader with acoustic guitar, no sheet music, improvising. Rose-gold accent on incense smoke (left) and guitar pick (right).` },
    { name: "02-room", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows ornate liturgical church with altar, cross, candles, icons, robed clergy. Right side shows a simple room with just chairs, a small stage, maybe a cross on the wall. Rose-gold accent on a candle flame (left) and the wall cross (right).` },
    { name: "03-people", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows congregation standing and kneeling in unison, following a printed order of service. Right side shows relaxed gathering, people sitting with coffee, casual conversation before service starts. Rose-gold accent on the prayer book (left) and coffee cup (right).` },
    { name: "04-sunday", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows communion at an altar rail, bread and wine, reverent kneeling. Right side shows communion passed in small cups through rows, casual and quick. Rose-gold accent on the chalice (left) and small cup (right).` },
    { name: "05-feel", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows ancient mystery - dim lighting, icons, contemplative silence. Right side shows warm spontaneity - laughter, hugs, someone sharing a testimony. Rose-gold accent on an icon frame (left) and a warm handshake (right).` },
  ],

  "compare-big-vs-small": [
    { name: "01-sound", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a large professional worship band with multiple singers, lights, production. Right side shows one person with an acoustic guitar leading worship in a small room. Rose-gold accent on a stage monitor (left) and the acoustic guitar body (right).` },
    { name: "02-room", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows a massive auditorium with hundreds of seats, multiple screens, balcony. Right side shows a cozy living room or small chapel with 20-30 chairs in a circle. Rose-gold accent on a screen (left) and a lamp (right).` },
    { name: "03-people", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows anonymous crowd - you can blend in, nobody notices. Right side shows small group where everyone knows each other, someone waving you over. Rose-gold accent on a welcome kiosk (left) and the waving hand (right).` },
    { name: "04-sunday", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows polished production - countdown timer, video opener, professional transitions. Right side shows organic flow - pastor greeting people by name, spontaneous prayer requests. Rose-gold accent on a countdown screen (left) and a handwritten prayer list (right).` },
    { name: "05-feel", prompt: `${STYLE_PREFIX} Scene split in two halves: Left side shows inspiring scale - concert-like atmosphere, energy from the crowd. Right side shows intimate belonging - shared meal after service, kids running around. Rose-gold accent on raised hands in crowd (left) and a shared plate of food (right).` },
  ],

  "prayer-guide": [
    { name: "01-hero", prompt: `${STYLE_PREFIX} Scene: A person sitting quietly on a chair by a window, morning light streaming in, hands resting open on their lap. A cup of tea nearby. Peaceful, still, inviting. Rose-gold accent on the sunlight on their hands.` },
    { name: "02-conversation", prompt: `${STYLE_PREFIX} Scene: Two simple chairs facing each other in a warm room, one chair empty, one with a person sitting casually. A metaphor for conversation with God. Soft light between the chairs. Rose-gold accent on the light between the chairs.` },
    { name: "03-gratitude", prompt: `${STYLE_PREFIX} Scene: A person at a kitchen table in the morning, coffee cup in hand, looking up with a gentle half-smile. Breakfast items on table, window with morning light. Everyday gratitude moment. Rose-gold accent on the coffee cup.` },
    { name: "04-sharing", prompt: `${STYLE_PREFIX} Scene: A person walking alone on a path outdoors, open sky above, gentle breeze in their hair. Thought-like shapes drifting upward softly, not literal thought bubbles. Reflective mood. Rose-gold accent on the path ahead.` },
    { name: "05-others", prompt: `${STYLE_PREFIX} Scene: Two people, one gently placing a hand on the other's shoulder. Both standing, simple background. Caring, not dramatic. Rose-gold accent on the hand on shoulder.` },
    { name: "06-listen", prompt: `${STYLE_PREFIX} Scene: A person sitting very still, eyes closed, in a comfortable chair. Warm soft glow around them, suggesting peace. Minimal details. Rose-gold accent on the warm glow.` },
    { name: "07-close", prompt: `${STYLE_PREFIX} Scene: Open hands, palms up, in a simple gesture. Nothing else in frame. Gentle, open, not religious or dramatic. Rose-gold accent on the fingertips catching light.` },
  ],
};

const selectedGuide = process.argv[2];
const outputBase = "tmp/guide-images";

async function generateImage(guide, image) {
  const dir = path.join(outputBase, guide);
  fs.mkdirSync(dir, { recursive: true });
  const outputPath = path.join(dir, `${image.name}.png`);

  if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 50000) {
    console.log(`Skip: ${guide}/${image.name} (exists)`);
    return true;
  }

  console.log(`Generating: ${guide}/${image.name}...`);
  try {
    const result = await imageModel.generateContent(image.prompt);
    const response = await result.response;
    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find(
      (p) => p.inlineData && p.inlineData.mimeType?.startsWith("image/")
    );
    if (!imagePart) {
      console.log(`No image data: ${guide}/${image.name}`);
      return false;
    }
    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    fs.writeFileSync(outputPath, buffer);
    console.log(`Saved: ${guide}/${image.name} (${Math.round(buffer.length / 1024)}KB)`);
    return true;
  } catch (err) {
    console.error(`Error: ${guide}/${image.name}: ${err.message}`);
    return false;
  }
}

function uploadToR2(guide, image) {
  const localPath = path.join(outputBase, guide, `${image.name}.png`);
  const r2Path = `guides/${guide}/${image.name}.png`;

  if (!fs.existsSync(localPath)) {
    console.log(`Skip upload: ${localPath} not found`);
    return false;
  }

  console.log(`Uploading: ${r2Path}...`);
  try {
    execSync(
      `npx wrangler r2 object put church-assets/${r2Path} --file "${localPath}" --content-type image/png`,
      { stdio: "pipe", timeout: 30000 }
    );
    console.log(`Uploaded: ${r2Path}`);
    return true;
  } catch (err) {
    console.error(`Upload error: ${r2Path}: ${err.message}`);
    return false;
  }
}

const guidesToProcess = selectedGuide ? { [selectedGuide]: guides[selectedGuide] } : guides;

if (selectedGuide && !guides[selectedGuide]) {
  console.error(`Unknown guide: ${selectedGuide}`);
  console.log(`Available: ${Object.keys(guides).join(", ")}`);
  process.exit(1);
}

let generated = 0;
let uploaded = 0;
let failed = 0;

for (const [guide, images] of Object.entries(guidesToProcess)) {
  console.log(`\n--- ${guide} (${images.length} images) ---\n`);
  for (const image of images) {
    if (await generateImage(guide, image)) {
      generated++;
      if (uploadToR2(guide, image)) uploaded++;
    } else {
      failed++;
    }
  }
}

console.log(`\nDone: ${generated} generated, ${uploaded} uploaded, ${failed} failed`);
