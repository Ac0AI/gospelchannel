#!/usr/bin/env node

/**
 * Fetch YouTube video IDs for new churches (16-30).
 * Run: source .env.local && node scripts/fetch-new-church-videos.mjs
 */

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
  console.error("Missing YOUTUBE_API_KEY. Run: source .env.local && node scripts/fetch-new-church-videos.mjs");
  process.exit(1);
}

const churches = [
  { name: "CityAlight", queries: [
    "CityAlight Yet Not I But Through Christ In Me",
    "CityAlight Only A Holy God",
    "CityAlight God Is For Us",
    "CityAlight Saved My Soul",
    "CityAlight The Lord Almighty Reigns",
    "CityAlight Christ Is Mine Forevermore",
    "CityAlight A Mighty Fortress",
    "CityAlight Ancient of Days",
    "CityAlight It Was Finished Upon That Cross",
    "CityAlight Blessed Assurance"
  ]},
  { name: "Cory Asbury", queries: [
    "Cory Asbury Reckless Love",
    "Cory Asbury The Father's House",
    "Cory Asbury I'm Sorry",
    "Cory Asbury Dear God",
    "Cory Asbury Sparrows",
    "Cory Asbury The Cross Has The Final Word",
    "Cory Asbury Unraveling",
    "Cory Asbury Son of God Bethel",
    "Cory Asbury Faithful To The End",
    "Cory Asbury Fill Me Up"
  ]},
  { name: "Pat Barrett", queries: [
    "Pat Barrett Build My Life",
    "Pat Barrett Good Good Father",
    "Pat Barrett The Way New Horizon",
    "Pat Barrett Praise",
    "Pat Barrett Canvas and Clay",
    "Pat Barrett Sails",
    "Pat Barrett Better",
    "Pat Barrett God Is So Good",
    "Pat Barrett Death Was Arrested",
    "Pat Barrett Hosanna Praise Is Rising"
  ]},
  { name: "Phil Wickham", queries: [
    "Phil Wickham Battle Belongs",
    "Phil Wickham House of the Lord",
    "Phil Wickham Living Hope",
    "Phil Wickham This Is Amazing Grace",
    "Phil Wickham Great Things",
    "Phil Wickham It's Always Been You",
    "Phil Wickham Hymn of Heaven",
    "Phil Wickham Sunday Is Coming",
    "Phil Wickham What An Awesome God",
    "Phil Wickham Divine"
  ]},
  { name: "Chris Tomlin", queries: [
    "Chris Tomlin How Great Is Our God",
    "Chris Tomlin Good Good Father",
    "Chris Tomlin Amazing Grace My Chains Are Gone",
    "Chris Tomlin Holy Is The Lord",
    "Chris Tomlin Our God",
    "Chris Tomlin Who You Say I Am",
    "Chris Tomlin Jesus Messiah",
    "Chris Tomlin Whom Shall I Fear",
    "Chris Tomlin Is He Worthy",
    "Chris Tomlin Nobody Loves Me Like You"
  ]},
  { name: "Matt Redman", queries: [
    "Matt Redman 10000 Reasons Bless The Lord",
    "Matt Redman Heart of Worship",
    "Matt Redman Blessed Be Your Name",
    "Matt Redman You Never Let Go",
    "Matt Redman Better Is One Day",
    "Matt Redman Let Everything That Has Breath",
    "Matt Redman Gracefully Broken",
    "Matt Redman Do It Again",
    "Matt Redman Your Grace Finds Me",
    "Matt Redman Mercy"
  ]},
  { name: "Kari Jobe", queries: [
    "Kari Jobe The Blessing",
    "Kari Jobe Revelation Song",
    "Kari Jobe Holy Spirit",
    "Kari Jobe Forever",
    "Kari Jobe Speak To Me",
    "Kari Jobe The Garden",
    "Kari Jobe I Am Not Alone",
    "Kari Jobe First Love",
    "Kari Jobe Heal Our Land",
    "Kari Jobe You Are For Me"
  ]},
  { name: "Lauren Daigle", queries: [
    "Lauren Daigle You Say",
    "Lauren Daigle Rescue",
    "Lauren Daigle How Can It Be",
    "Lauren Daigle Trust In You",
    "Lauren Daigle First",
    "Lauren Daigle Thank God I Do",
    "Lauren Daigle Look Up Child",
    "Lauren Daigle Hold On To Me",
    "Lauren Daigle Come Alive",
    "Lauren Daigle These Are The Days"
  ]},
  { name: "Casting Crowns", queries: [
    "Casting Crowns Who Am I",
    "Casting Crowns Praise You In This Storm",
    "Casting Crowns Voice of Truth",
    "Casting Crowns East to West",
    "Casting Crowns Glorious Day",
    "Casting Crowns Just Be Held",
    "Casting Crowns Nobody",
    "Casting Crowns Scars In Heaven",
    "Casting Crowns Only Jesus",
    "Casting Crowns Until The Whole World Hears"
  ]},
  { name: "for KING & COUNTRY", queries: [
    "for KING COUNTRY God Only Knows",
    "for KING COUNTRY joy",
    "for KING COUNTRY Burn The Ships",
    "for KING COUNTRY Together",
    "for KING COUNTRY Relate",
    "for KING COUNTRY Priceless",
    "for KING COUNTRY Fix My Eyes",
    "for KING COUNTRY It's Not Over Yet",
    "for KING COUNTRY Amen",
    "for KING COUNTRY What Are We Waiting For"
  ]},
  { name: "TobyMac", queries: [
    "TobyMac I just need U",
    "TobyMac Speak Life",
    "TobyMac Made To Love",
    "TobyMac Me Without You",
    "TobyMac Gone",
    "TobyMac Feel It",
    "TobyMac Love Broke Thru",
    "TobyMac Help Is On The Way",
    "TobyMac Everything",
    "TobyMac 21 Years"
  ]},
  { name: "Lecrae", queries: [
    "Lecrae I'll Find You ft Tori Kelly",
    "Lecrae Blessings ft Ty Dolla Sign",
    "Lecrae All I Need Is You",
    "Lecrae Coming In Hot Andy Mineo",
    "Lecrae Tell The World",
    "Lecrae Don't Waste Your Life",
    "Lecrae Messengers",
    "Lecrae I Am Second",
    "Lecrae Broke",
    "Lecrae Drown"
  ]},
  { name: "Tauren Wells", queries: [
    "Tauren Wells Known",
    "Tauren Wells Hills and Valleys",
    "Tauren Wells Famous For I Believe",
    "Tauren Wells God's Not Done With You",
    "Tauren Wells When We Pray",
    "Tauren Wells Fake It",
    "Tauren Wells Citizen of Heaven",
    "Tauren Wells Like You Love Me",
    "Tauren Wells Joy In The Morning",
    "Tauren Wells Miracle"
  ]},
  { name: "Tasha Cobbs Leonard", queries: [
    "Tasha Cobbs Leonard Break Every Chain",
    "Tasha Cobbs Leonard You Know My Name",
    "Tasha Cobbs Leonard For Your Glory",
    "Tasha Cobbs Leonard Gracefully Broken",
    "Tasha Cobbs Leonard Your Spirit",
    "Tasha Cobbs Leonard Put A Praise On It",
    "Tasha Cobbs Leonard Fill Me Up",
    "Tasha Cobbs Leonard The Name Of Our God",
    "Tasha Cobbs Leonard In Spite Of Me",
    "Tasha Cobbs Leonard You Still Love Me"
  ]},
  { name: "Travis Greene", queries: [
    "Travis Greene Made A Way",
    "Travis Greene You Waited",
    "Travis Greene Intentional",
    "Travis Greene Won't Let Go",
    "Travis Greene Be Still",
    "Travis Greene While I'm Waiting",
    "Travis Greene Good and Loved",
    "Travis Greene See The Light",
    "Travis Greene Fell In Love",
    "Travis Greene Worship Rise"
  ]}
];

async function searchYouTube(query) {
  const params = new URLSearchParams({
    key: API_KEY,
    part: "snippet",
    type: "video",
    maxResults: "1",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    q: query,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403) {
      console.error("Quota exceeded:", body);
      process.exit(1);
    }
    return null;
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) return null;

  return {
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
  };
}

async function main() {
  for (const church of churches) {
    console.log(`\n${church.name}:`);
    for (const query of church.queries) {
      const result = await searchYouTube(query);
      if (result) {
        console.log(`${result.videoId}|${result.title}|${result.channelTitle}`);
      } else {
        console.log(`NOTFOUND|${query}|`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
