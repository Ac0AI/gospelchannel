#!/usr/bin/env node
/**
 * Fetch YouTube video IDs for worship churches using YouTube Data API v3
 *
 * Usage:
 *   source .env.local && node scripts/fetch-youtube-ids.mjs
 *
 * Output format per church:
 *   CHURCH_NAME:
 *   videoId|title|channelTitle
 */

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('Missing YOUTUBE_API_KEY. Run: source .env.local && node scripts/fetch-youtube-ids.mjs');
  process.exit(1);
}

const churches = [
  {
    name: "Hillsong Worship",
    queries: [
      "Hillsong Worship What A Beautiful Name",
      "Hillsong Worship Oceans Where Feet May Fail",
      "Hillsong Worship Who You Say I Am",
      "Hillsong Worship Cornerstone live",
      "Hillsong Worship Mighty To Save",
      "Hillsong Worship This I Believe The Creed",
      "Hillsong Worship Broken Vessels Amazing Grace",
      "Hillsong Worship Open Heaven River Wild",
      "Hillsong Worship King of Kings",
      "Hillsong Worship Hosanna",
      "Hillsong Worship Still",
      "Hillsong Worship Shout to the Lord"
    ]
  },
  {
    name: "Elevation Worship",
    queries: [
      "Elevation Worship Jireh Maverick City",
      "Elevation Worship Graves Into Gardens",
      "Elevation Worship O Come to the Altar",
      "Elevation Worship Praise",
      "Elevation Worship RATTLE",
      "Elevation Worship Do It Again",
      "Elevation Worship The Blessing Kari Jobe",
      "Elevation Worship Same God",
      "Elevation Worship Trust In God",
      "Elevation Worship Here Again",
      "Elevation Worship Won't Stop Now",
      "Elevation Worship See A Victory"
    ]
  },
  {
    name: "Bethel Music",
    queries: [
      "Bethel Music Goodness of God Jenn Johnson",
      "Bethel Music Reckless Love Cory Asbury",
      "Bethel Music No Longer Slaves Jonathan David Helser",
      "Bethel Music Raise A Hallelujah",
      "Bethel Music You Make Me Brave Amanda Cook",
      "Bethel Music One Thing Remains",
      "Bethel Music King of My Heart",
      "Bethel Music Living Hope Phil Wickham",
      "Bethel Music Ever Be",
      "Bethel Music It Is Well"
    ]
  },
  {
    name: "Maverick City Music",
    queries: [
      "Maverick City Music Jireh Chandler Moore",
      "Maverick City Music Promises Naomi Raine",
      "Maverick City Music Man of Your Word Chandler Moore",
      "Maverick City Music Refiner",
      "Maverick City Music Talking to Jesus",
      "Maverick City Music I Thank God",
      "Maverick City Music Wait on You",
      "Maverick City Music Firm Foundation",
      "Maverick City Music Breathe",
      "Maverick City Music Thank You"
    ]
  },
  {
    name: "Hillsong UNITED",
    queries: [
      "Hillsong UNITED Oceans Where Feet May Fail",
      "Hillsong UNITED So Will I 100 Billion X",
      "Hillsong UNITED Touch the Sky",
      "Hillsong UNITED Hosanna",
      "Hillsong UNITED Mighty to Save",
      "Hillsong UNITED This I Believe The Creed",
      "Hillsong UNITED Even When It Hurts Praise Song",
      "Hillsong UNITED Wonder",
      "Hillsong UNITED Good Grace",
      "Hillsong UNITED Know You Will"
    ]
  },
  {
    name: "Planetshakers",
    queries: [
      "Planetshakers Endless Praise live",
      "Planetshakers Turn It Up",
      "Planetshakers Made For Worship",
      "Planetshakers Only Way",
      "Planetshakers All I Need Is You",
      "Planetshakers Nothing Is Impossible",
      "Planetshakers Abounding Grace",
      "Planetshakers The Anthem",
      "Planetshakers Heal Our Land",
      "Planetshakers Leave Me Astounded"
    ]
  },
  {
    name: "UPPERROOM",
    queries: [
      "UPPERROOM Surrounded Fight My Battles",
      "UPPERROOM Yahweh worship",
      "UPPERROOM Mention of Your Name",
      "UPPERROOM Open My Eyes",
      "UPPERROOM Firm Foundation",
      "UPPERROOM Anointing",
      "UPPERROOM Set Apart",
      "UPPERROOM worship spontaneous live",
      "UPPERROOM Steal My Heart",
      "UPPERROOM Worthy of It All"
    ]
  },
  {
    name: "Passion",
    queries: [
      "Passion Glorious Day Kristian Stanfill",
      "Passion Even So Come Chris Tomlin",
      "Passion Whole Heart",
      "Passion How Great Is Our God Chris Tomlin",
      "Passion God You're So Good",
      "Passion Follow You Anywhere",
      "Passion There Is A Name Sean Curran",
      "Passion Raise A Hallelujah",
      "Passion Lord I Need You Matt Maher",
      "Passion Way Maker live"
    ]
  },
  {
    name: "Jesus Culture",
    queries: [
      "Jesus Culture Your Name Is Power",
      "Jesus Culture In The River Kim Walker Smith",
      "Jesus Culture Break Every Chain",
      "Jesus Culture One Thing Remains",
      "Jesus Culture Fierce",
      "Jesus Culture Revival",
      "Jesus Culture Freedom",
      "Jesus Culture Miracles",
      "Jesus Culture Still In Control",
      "Jesus Culture Living With A Fire"
    ]
  },
  {
    name: "Sinach",
    queries: [
      "Sinach Way Maker official video",
      "Sinach I Know Who I Am official",
      "Sinach Great Are You Lord",
      "Sinach He Did It Again",
      "Sinach Rejoice",
      "Sinach Matchless Love",
      "Sinach The Name of Jesus",
      "Sinach Simply Devoted",
      "Sinach I Stand Amazed",
      "Sinach For This"
    ]
  },
  {
    name: "Mosaic MSC",
    queries: [
      "Mosaic MSC Tremble",
      "Mosaic MSC God Who Moves",
      "Mosaic MSC Chain Breaker",
      "Mosaic MSC Run To You",
      "Mosaic MSC Never",
      "Mosaic MSC Glory To Glory",
      "Mosaic MSC This Is How I Thank the Lord",
      "Mosaic MSC Search Party",
      "Mosaic MSC Love",
      "Mosaic MSC Trust"
    ]
  },
  {
    name: "Vertical Worship",
    queries: [
      "Vertical Worship Spirit of the Living God",
      "Vertical Worship Yes I Will",
      "Vertical Worship Open Up The Heavens",
      "Vertical Worship Faithfulness",
      "Vertical Worship The Rock Won't Move",
      "Vertical Worship Lamb of God",
      "Vertical Worship Come Holy Spirit",
      "Vertical Worship Exalted Over All",
      "Vertical Worship He Is Here",
      "Vertical Worship Restore My Soul"
    ]
  },
  {
    name: "Life.Church Worship",
    queries: [
      "Life.Church Worship official",
      "Life.Church Worship songs live",
      "Life Church Worship At the Cross",
      "Life Church Worship Here For You",
      "Life Church Worship Never Stop Singing",
      "Life Church Worship Move",
      "Life Church Worship God With Us",
      "Life Church Worship Praise God",
      "Life Church Worship All In",
      "Life Church Worship Holy"
    ]
  },
  {
    name: "Worship Central",
    queries: [
      "Worship Central The Cross Has The Final Word",
      "Worship Central Spirit Break Out",
      "Worship Central Let It Be Known",
      "Worship Central Mercy Road",
      "Worship Central Father of Lights",
      "Worship Central Saviour of the World",
      "Worship Central The Way",
      "Worship Central Jesus You Alone",
      "Worship Central Wider",
      "Worship Central The Same Power"
    ]
  },
  {
    name: "Gateway Worship",
    queries: [
      "Gateway Worship Spirit of the Living God",
      "Gateway Worship Revelation Song",
      "Gateway Worship Great Great God",
      "Gateway Worship Trustworthy",
      "Gateway Worship God Be Praised",
      "Gateway Worship Living For You",
      "Gateway Worship Only King Forever",
      "Gateway Worship In The Name",
      "Gateway Worship We Exalt Your Name",
      "Gateway Worship Praise The Invisible"
    ]
  }
];

async function searchYouTube(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    console.error(`API Error for "${query}": ${JSON.stringify(data.error.message)}`);
    return null;
  }
  if (data.items && data.items.length > 0) {
    const item = data.items[0];
    return {
      videoId: item.id.videoId,
      title: item.snippet.title.replace(/\|/g, '-').replace(/\n/g, ' '),
      channelTitle: item.snippet.channelTitle.replace(/\|/g, '-').replace(/\n/g, ' ')
    };
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  for (const church of churches) {
    console.error(`Searching: ${church.name}...`);
    console.log(`\n${church.name}:`);
    const seen = new Set();
    for (const query of church.queries) {
      const result = await searchYouTube(query);
      if (result && !seen.has(result.videoId)) {
        seen.add(result.videoId);
        console.log(`${result.videoId}|${result.title}|${result.channelTitle}`);
      }
      await sleep(120); // Rate limit: ~8 requests/sec
    }
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
