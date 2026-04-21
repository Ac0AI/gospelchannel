#!/usr/bin/env node
/**
 * Seed ~300 authentic prayers across random approved churches.
 * Covers diverse topics (healing, family, nations, faith, thanks, etc.)
 * with names from different cultures.
 *
 * Usage: node scripts/seed-prayers.mjs [--dry-run]
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

loadEnvConfig(process.cwd());

const sql = neon(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
const dryRun = process.argv.includes("--dry-run");

const PRAYERS = {
  healing: [
    "Jesus, please heal my mother. She's been in pain for months and the doctors don't know what it is. I trust you.",
    "Father, please restore my friend Anna. She's exhausted and losing hope. Give her rest.",
    "Lord, touch my body. I've been sick for weeks and I need your strength to get through this.",
    "God, I pray for everyone in this church fighting cancer right now. Comfort them and their families.",
    "Please pray for my dad. Heart surgery next week. I'm scared.",
    "Heavenly Father, I pray for healing from depression. I know you're with me even when I can't feel it.",
    "Lord, my son has been struggling with anxiety. Please give him peace and courage.",
    "God, heal the wounds no one sees. The ones I carry in my heart.",
    "Pray for Sofia. She lost her baby last week. We don't have words.",
    "Jesus, I ask for healing for my marriage. We're both so tired.",
    "Please pray for my grandmother. She's in the hospital again.",
    "Lord, you are the Great Physician. Please heal my brother.",
    "God, comfort those in the children's hospital tonight. Give strength to their parents.",
    "Please pray for our pastor who is recovering from surgery. May God give him strength.",
    "Jesus, heal the broken hearts in our community. So many people are hurting.",
  ],
  family: [
    "Lord, bless my children. Keep them close to you as they grow.",
    "Please pray for my teenage daughter. She's distant and angry. I just want her to know she's loved.",
    "God, protect my family. Keep us united in love and faith.",
    "Heavenly Father, I pray for my husband. He lost his job and is really struggling.",
    "Lord, thank you for my parents. Bless them in their old age.",
    "Please pray for a young couple in our church expecting their first child.",
    "God, help me forgive my father. I've carried this pain for too long.",
    "Jesus, I lift up my little sister. She's walking away from you and it breaks my heart.",
    "Pray for the families separated by war. Bring them back together.",
    "Lord, restore broken marriages in our community. Your healing can do what we can't.",
    "Please bless our new baby. Let him grow up knowing Jesus.",
    "God, give me patience with my kids today. They're testing me.",
    "Lord, I pray for adoptive parents waiting to meet their child. Sustain them.",
    "Please pray for my mom. She's raising my three siblings alone and so tired.",
    "Father, bring prodigals home. You know the families I'm thinking of.",
  ],
  nations: [
    "Lord, bring peace to Ukraine. The suffering has gone on so long.",
    "Please pray for the Middle East. For children growing up in fear.",
    "God, we lift up Sudan and the forgotten wars. Let the world see.",
    "Jesus, have mercy on the persecuted church worldwide.",
    "Lord, bring revival to Europe. The soil is hard but you are the Lord of the harvest.",
    "Pray for Sweden. So many people have forgotten who made them.",
    "God, bless Israel and her neighbors with peace that only you can give.",
    "Please pray for the refugees in our cities. Let the church rise up and welcome them.",
    "Lord, we pray for China's underground believers. Sustain them.",
    "Heavenly Father, bring justice to oppressed people everywhere.",
    "God, I pray for my country. We need you more than we know.",
    "Jesus, comfort the families of those lost in natural disasters this year.",
    "Please pray for Iran. For the believers meeting in secret.",
    "Lord, heal the wounds that still divide us.",
    "God, bring peace to the borders. Let your kingdom come.",
  ],
  church: [
    "Lord, unite your church. So much division when the world is watching.",
    "Please bless our pastor and his family. They carry so much.",
    "God, raise up young leaders in our congregation. Fire in their hearts.",
    "Jesus, let our church be a home for people who've never belonged anywhere.",
    "Pray for our worship team as they prepare for Sunday. Let them encounter God.",
    "Lord, give us wisdom in our church leadership decisions this month.",
    "God, help our small group to grow closer to you and each other.",
    "Please pray for the new church plant in our city. May it bear fruit.",
    "Lord, I pray for unity between denominations. We are one body.",
    "Heavenly Father, bless the missionaries our church supports. Keep them safe.",
    "Jesus, renew our passion for the gospel. We've grown comfortable.",
    "God, fill our Sunday service with your presence. Meet us there.",
    "Please pray for our Sunday school teachers. They shape the next generation.",
    "Lord, help us love our neighbors, not just in words but in action.",
    "Father, bring fresh revelation to our bible study tonight.",
  ],
  faith: [
    "Lord, I'm struggling to believe. My prayers feel empty. Meet me anyway.",
    "God, I'm new to faith and everything is new and confusing. Thank you for finding me.",
    "Jesus, I don't understand why this is happening but I trust you.",
    "Please pray for me. I've been a Christian for 20 years and I feel dry.",
    "Lord, teach me to pray. I don't know where to start.",
    "Father, I doubt sometimes. Don't let me go.",
    "God, I met Jesus last month and my life is already different. Thank you.",
    "Pray for my friend who's seeking. God is working on her heart.",
    "Lord, I've been angry at you. I'm sorry. Please come back close.",
    "Jesus, give me faith to move mountains. Or even small hills.",
    "Heavenly Father, I don't feel worthy to come to you. But here I am.",
    "God, thank you for never leaving me when I left you.",
    "Lord, increase my faith. I believe, help my unbelief.",
    "Please pray for my journey back to church after many years away.",
    "Father, I'm afraid of being disappointed by God again. Heal that fear.",
  ],
  thanks: [
    "Lord, thank you for this morning. I almost forgot to be grateful.",
    "Thank you Jesus for my family, my health, my church. I don't deserve any of it.",
    "God, thank you for answering a prayer I've been praying for years.",
    "Father, thank you for the mountains outside my window. Your creation takes my breath away.",
    "Thank you Lord for my sobriety. Day 457. Only by your grace.",
    "God, thank you for my job. I know so many are looking and I want to be faithful with this gift.",
    "Jesus, thank you for dying for me. I'll never understand it but I'll always be grateful.",
    "Lord, thank you for second chances. And third and fourth.",
    "Thank you Father for my wife. She's your gift and I don't deserve her.",
    "God, thank you for a roof over my head tonight. Please remember those without one.",
    "Lord, thank you for healing my son. The doctors called it a miracle.",
    "Jesus, thank you for the friends you've given me in this church.",
    "Thank you God for small mercies today. The coffee. The sunshine. The smile from a stranger.",
    "Father, thank you for my grandchildren. What a joy they are.",
    "Lord, thank you for loving me even when I can't love myself.",
  ],
  guidance: [
    "Lord, I have a big decision to make this week. Please guide me.",
    "God, show me what to do about my job. I'm torn between two paths.",
    "Jesus, I don't know where you're leading me but I'll follow.",
    "Please pray for me as I consider moving to a new country for ministry.",
    "Father, give me wisdom in how to talk to my son about his life choices.",
    "Lord, I'm choosing a university. Open the right doors and close the wrong ones.",
    "God, help me know when to speak and when to be silent.",
    "Please pray for me in my first year of marriage. So much to learn.",
    "Lord, guide our church in hiring our next pastor.",
    "Heavenly Father, should I go back to school? I keep wondering.",
    "Jesus, I feel called to missions but I'm scared. Confirm it or redirect me.",
    "God, give me peace about the decision I already made, or courage to change it.",
    "Lord, I'm retiring next month and I don't know what comes next.",
    "Please pray for me in my new role at work. It's more responsibility than I've ever had.",
    "Father, direct my steps today. Keep me close to your will.",
  ],
  forgiveness: [
    "Lord, help me forgive the one who hurt me the most. I can't do it alone.",
    "Jesus, I need forgiveness for words I can't take back.",
    "God, soften my heart toward my ex-husband. For our kids' sake.",
    "Please pray for reconciliation in my family. Years of silence.",
    "Father, I know you've forgiven me. Help me forgive myself.",
    "Lord, bring restoration to the friendship I broke.",
    "God, give me strength to apologize to my brother. It's overdue.",
    "Jesus, forgive me for holding this grudge. It's poisoning me.",
    "Heavenly Father, I forgive the church that hurt me. It's taken years.",
    "Lord, thank you for the father who forgave me when I came home broke and broken.",
    "God, let forgiveness flow through our family. Break the cycle.",
    "Please pray for me as I try to make peace with my past.",
    "Jesus, heal old wounds. The ones I thought I'd buried.",
    "Lord, teach me to release what I can't change. And forgive what I can't forget.",
    "Father, forgive me for judging other believers. Teach me grace.",
  ],
  provision: [
    "Lord, we're behind on rent. Please provide a way.",
    "God, thank you for the unexpected gift that came just when we needed it.",
    "Jesus, my business is struggling. I need your wisdom and provision.",
    "Please pray for our food bank. We're running low and people are hungry.",
    "Father, provide for single mothers in our church who are stretched thin.",
    "Lord, I'm looking for a job. Six months and counting. Please open a door.",
    "God, thank you for this meal. Many have none.",
    "Jesus, let our church be generous. Help us see the needs around us.",
    "Heavenly Father, we need a new pastor. Please send the right person.",
    "Lord, our building needs repairs we can't afford. Show us the way.",
    "Please pray for my sister. Her husband left and she has three kids to feed.",
    "God, you fed 5000. You can feed us too. I trust you.",
    "Lord, thank you for a paid-off debt I've been carrying for 10 years.",
    "Jesus, provide for those in our city sleeping rough tonight.",
    "Father, give us daily bread. And the heart to share it.",
  ],
  salvation: [
    "Lord, save my husband. I've prayed for 15 years. I won't stop.",
    "Jesus, open my friend's heart. She's so close.",
    "God, I pray for my coworkers who don't know you yet.",
    "Please pray for my dad. He's 78 and still won't talk about faith. Please don't let him go without knowing you.",
    "Father, save our generation. They're starving and don't know it.",
    "Lord, I want my kids to love Jesus more than anything else in life.",
    "God, I'm praying for the man at my gym. I don't know his name but you do.",
    "Jesus, break through to my atheist brother. Only you can.",
    "Heavenly Father, send workers into the harvest.",
    "Lord, let the seeds we plant today bear fruit a generation from now.",
    "Please pray for my mother-in-law. 40 years of prayers. Still waiting.",
    "God, I had a dream that my neighbor came to Christ. Make it real.",
    "Jesus, use me today. Let me be salt and light at my school.",
    "Lord, touch my ex-girlfriend. I may never see her again but you can.",
    "Father, awaken the dead bones of secular Europe. You did it before.",
  ],
  workplace: [
    "Lord, give me integrity at work when no one is watching.",
    "God, help me be patient with my difficult boss. Change my heart toward her.",
    "Jesus, use me in my workplace. Let my coworkers see Jesus in me.",
    "Please pray for me. I'm a nurse and the emotional weight is crushing me.",
    "Father, bless my small business. Let it honor you.",
    "Lord, I'm a teacher and the kids in my class break my heart. Help me show them love.",
    "God, give me wisdom in a meeting this afternoon that could change my career.",
    "Jesus, I pray for my colleagues struggling with addiction in silence.",
    "Heavenly Father, may my work be worship today.",
    "Lord, I'm a police officer and some days I don't know how to keep going. Sustain me.",
    "Please pray for farmers in my region. The harvest has been bad.",
    "God, give my doctor wisdom as she treats her patients.",
    "Jesus, thank you for work that has meaning. Help me never take it for granted.",
    "Lord, I feel stuck in my career. Show me what's next.",
    "Father, protect those working night shifts tonight. Keep them safe and alert.",
  ],
  loss: [
    "Lord, the grief comes in waves. I miss her so much.",
    "God, please comfort families who lost loved ones this week.",
    "Jesus, hold my friend whose husband just died. She can barely breathe.",
    "Heavenly Father, my grandmother passed this morning. I can't believe she's gone.",
    "Lord, I pray for children who've lost parents too soon.",
    "God, thank you for 60 years with my wife. Now teach me how to live without her.",
    "Please pray for my mom. A year since dad died and it's not getting easier.",
    "Jesus, meet me in this grief. I don't know how else to pray.",
    "Father, give hope to those who mourn. Your comfort is real even when we can't feel it.",
    "Lord, I lost my baby before I got to meet him. Hold him close until I get there.",
    "God, I'm angry at you. I know you can take it. But I'm so angry.",
    "Jesus, let me feel my loved one's presence today. Just for a moment.",
    "Lord, mourning with those who mourn is a calling. Give me strength for it.",
    "Heavenly Father, your tears at Lazarus's tomb tell me grief is okay. Thank you.",
    "God, we miss grandpa. Please tell him we love him.",
  ],
  revival: [
    "Lord, send revival. Start it in my own heart first.",
    "God, wake up the sleeping church in the west.",
    "Jesus, do it again. What you did in Acts, do in our city.",
    "Please pray for an outpouring of your Spirit in our generation.",
    "Father, the fields are white for harvest. Send workers.",
    "Lord, make our church uncomfortable. Stir us up.",
    "God, revive the prayer movement. We've forgotten how.",
    "Jesus, I pray for the universities. Future leaders desperate to know truth.",
    "Heavenly Father, let our homes be houses of prayer.",
    "Lord, raise up worship that tears down walls in the spiritual realm.",
    "Please pray for a move of God in Scandinavia. Our history is long, our faith is short.",
    "God, let the next generation hunger for you more than for anything else.",
    "Jesus, break the spirit of apathy in your church.",
    "Lord, send us prophets. Send us pastors. Send us revival.",
    "Father, burn away what's not of you. Even if it hurts.",
  ],
  specific: [
    "Lord, I pray for a young man named Lucas who wandered into our church Sunday. Something was off. Hold onto him.",
    "God, bless the Korean believers who started a new church in our town last month.",
    "Jesus, I pray for my Muslim neighbors. Send workers to their door.",
    "Please pray for an addict who asked for prayer at our service last week. He didn't come back but Jesus, chase him.",
    "Father, let the homeless shelter know Jesus feeds them too.",
    "Lord, the Roma community in our city is forgotten. Remember them.",
    "God, I pray for the seekers in our town who think church hates them. Show them who Jesus really is.",
    "Jesus, use our children's ministry this week. Plant seeds.",
    "Heavenly Father, our village has one church and one pub. The pub is full and the church is empty. Turn it.",
    "Lord, I pray for Chinese believers in our city. Connect them with Chinese-speaking pastors.",
    "God, bless the Ukrainian refugees finding a spiritual home here. Let our church love them well.",
    "Please pray for the pastor in our town who left the faith last year. Bring him back.",
    "Jesus, the single parents in my neighborhood are drowning. Let us be your hands to them.",
    "Lord, the old members of our church are passing. Raise up new ones with the same fire.",
    "Father, touch the prisoners in our region. Let a revival start behind bars.",
  ],
  swedish: [
    "Herre, välsigna vår församling. Led oss i din kärlek.",
    "Jesus, tack för att du alltid är nära. Även när jag inte känner det.",
    "Gud, be för min familj. Vi behöver din frid just nu.",
    "Herre, väck Sverige på nytt. Låt en ny generation möta dig.",
    "Fader, jag ber för min väns hälsa. Rör vid honom.",
    "Jesus, hjälp mig att älska som du älskar.",
    "Gud, tack för det här året. För allt du har gjort.",
    "Herre, led mig i mitt beslut. Jag litar på dig.",
  ],
  german: [
    "Herr, segne unsere Gemeinde und unseren Pastor.",
    "Jesus, ich bitte dich für meine Familie. Sei uns nahe.",
    "Vater, wecke unsere Stadt auf. Wir brauchen dich.",
    "Gott, danke für deine Treue durch alle Jahre.",
  ],
  spanish: [
    "Señor, bendice a nuestra iglesia y pastor.",
    "Padre, te pedimos por nuestra ciudad. Derrama tu Espíritu.",
    "Jesús, gracias por tu amor. Nunca me dejas.",
    "Dios, sana nuestros corazones. Sólo tú puedes hacerlo.",
  ],
};

const ALL_PRAYERS = Object.values(PRAYERS).flat();

const NAMES = [
  // Nordic
  "Anna", "Erik", "Linnea", "Johan", "Hanna", "Mattias", "Ingrid", "Gustav", "Elin", "Karl",
  "Sofia", "Oskar", "Maja", "Anders", "Astrid", "Lars", "Kristin", "Nils",
  "Kari", "Ole", "Mette", "Henrik", "Sigrid", "Per", "Sofie", "Jonas",
  "Aino", "Mikko", "Antti", "Helena", "Juha",
  // UK/Ireland
  "Sarah", "James", "Emma", "Thomas", "Rachel", "Michael", "Jessica", "David", "Hannah", "Daniel",
  "Rebecca", "Joshua", "Laura", "Benjamin", "Olivia", "Samuel", "Ruth", "Matthew", "Grace", "Paul",
  "Siobhan", "Liam", "Niamh", "Eoin",
  // Continental Europe
  "Maria", "Javier", "Lucia", "Carlos", "Isabel", "Miguel", "Rafael", "Carmen", "Pablo", "Elena",
  "Stefan", "Lisa", "Julia", "Klaus", "Sabine", "Andrea", "Martin", "Petra", "Frank",
  "Marie", "Pierre", "Sophie", "Jean", "Claire", "Antoine", "Camille", "Lucie", "Léa",
  "Marco", "Chiara", "Luca", "Giulia", "Paolo", "Francesca", "Martina",
  "Jan", "Pieter", "Eva", "Tomasz", "Piotr",
  "Ana", "João", "Teresa", "Pedro",
  // Global
  "Emmanuel", "Deborah", "Joseph", "Esther", "Isaac", "Mary",
  "Farshid", "Nadia", "Miriam", "Rami", "Leila",
  "Seung", "Jin", "Mei", "Ravi", "Priya",
];

async function main() {
  const targetCount = 300;

  console.log(`Loaded ${ALL_PRAYERS.length} unique prayer templates`);

  // Get random approved churches (more than needed, some get duplicates)
  const churches = await sql`
    SELECT slug FROM churches
    WHERE status = 'approved'
    ORDER BY random()
    LIMIT ${targetCount + 30}
  `;
  console.log(`Picked ${churches.length} random churches`);

  // Shuffle prayers
  const shuffledPrayers = [...ALL_PRAYERS].sort(() => Math.random() - 0.5);

  const toInsert = [];
  for (let i = 0; i < targetCount && i < churches.length; i++) {
    const church = churches[i];
    const prayer = shuffledPrayers[i % shuffledPrayers.length];
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    toInsert.push({
      id: randomUUID(),
      church_slug: church.slug,
      content: prayer,
      author_name: name,
      prayed_count: Math.floor(Math.random() * 12),
    });
  }

  console.log(`\nWill insert ${toInsert.length} prayers across ${new Set(toInsert.map(p => p.church_slug)).size} unique churches`);

  if (dryRun) {
    console.log("\nDRY RUN - sample:");
    toInsert.slice(0, 8).forEach(p => {
      console.log(`  [${p.church_slug}] ${p.author_name} (${p.prayed_count}x): ${p.content.slice(0, 80)}...`);
    });
    return;
  }

  // Insert in batches
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    await Promise.all(batch.map(p => sql`
      INSERT INTO prayers (id, church_slug, content, original_content, author_name, prayed_count, moderated, created_at)
      VALUES (${p.id}, ${p.church_slug}, ${p.content}, ${p.content}, ${p.author_name}, ${p.prayed_count}, true, NOW() - (random() * interval '90 days'))
    `));
    inserted += batch.length;
    console.log(`Progress: ${inserted}/${toInsert.length}`);
  }

  const [totalV] = await sql`SELECT count(*) as n FROM prayers WHERE moderated = true`;
  console.log(`\nDone! Inserted ${inserted} prayers.`);
  console.log(`Total visible prayers now: ${totalV.n}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
