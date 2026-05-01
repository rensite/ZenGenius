import { parseLyrics } from './parseLyrics'
import type { Track } from '@/types/domain'

interface SeedDef {
  id: string
  title: string
  artist: string
  album?: string
  about?: string
  characters?: string[]
  lyrics: string
}

const SEEDS: SeedDef[] = [
  {
    id: 'architecture-of-silence',
    title: 'The Architecture of Silence',
    artist: 'Vignette 04',
    album: 'Quiet Light',
    about:
      'A meditation on what we leave unsaid. The narrator wanders an emptied city built from the negative space of conversations that never happened. Each chorus collapses the structure another floor.',
    characters: ['The Narrator', 'The City'],
    lyrics: `[Verse 1]
The concrete speaks in whispers tonight
Tracing the geometry of forgotten shadows
Fifteen windows and some burnt out lies
Waiting for the rain to bleach the memory

[Chorus]
Oh, build the walls of paper thin
Let the quiet light leak in
We are ghosts in our own design
Trapped inside a borderless line

[Verse 2]
Steel beams bending under the weight
Of every word we decided not to say
A blueprint for a cathedral of dust
Sacrificing logic for a moment of trust

[Verse 3]
The skyline is a jagged EKG
Measuring the pulse of a dying city
We walk through doors that don't exist
Wrapped in a structural, velvet mist

[Chorus]
Oh, build the walls of paper thin
Let the quiet light leak in
We are ghosts in our own design
Trapped inside a borderless line

[Outro]
Of everything we built with empty hands
It turns to glass, it turns to sand
The architecture of silence is all that remains
In the blueprint of our hidden pains`,
  },
  {
    id: 'paper-cartographer',
    title: 'Paper Cartographer',
    artist: 'Halen Crow',
    album: 'Maps to Nowhere',
    about:
      'A folk-noir piece about a man who maps places that no longer exist. Each verse he draws another country onto a tablecloth, knowing the borders will be washed away by morning.',
    characters: ['Halen', 'The Cartographer'],
    lyrics: `[Intro]
Pin the moon on the tablecloth
Draw the rivers in coffee and salt
Tell me where you ran when the static came

[Verse 1]
I am a paper cartographer, ink on my sleeve
Mapping every country that I've had to leave
North of the kettle, south of the chair
A continent of crumbs and a coastline of hair

[Pre-Chorus]
And the kitchen light hums like an oracle
The dog dreams of borders he can't recall

[Chorus]
So fold me into a city, fold me into a state
I'll be honest by Tuesday, I'll be lost by eight
Every place I've drawn is a place I've named
And every place I've named is a place I've blamed

[Verse 2]
She left me an atlas of half-finished rooms
The kind you can hum but you can't ever move through
I traced her in pencil, I traced her in tea
Now the only territory I own is me

[Bridge]
The compass spins for the country of nobody
The compass spins for the country of nobody

[Chorus]
So fold me into a city, fold me into a state
I'll be honest by Tuesday, I'll be lost by eight
Every place I've drawn is a place I've named
And every place I've named is a place I've blamed

[Outro]
Pin the moon on the tablecloth
Wash it down with the morning rain
Pin the moon on the tablecloth
And start it all again`,
  },
  {
    id: 'low-orbit-lullaby',
    title: 'Low Orbit Lullaby',
    artist: 'Marina Vey',
    album: 'Apogee',
    about:
      'An ambient pop ballad sung from a decommissioned satellite to the engineer who built it. The narrator narrates her decay as a romance — every burnt circuit a love letter, every meteor a kiss.',
    characters: ['Sat-9 (the satellite)', 'The Engineer'],
    lyrics: `[Verse 1]
You wound my copper into a heart
Soldered a hymn through the dark
Sent me to spin in the dust of the stars
Loving the shape of your hands from afar

[Pre-Chorus]
And the static remembers your voice, my dear
The static remembers, but you don't hear

[Chorus]
Hold me in low orbit, hold me in low light
Burn me a lullaby, burn me a flight
Every meteor I swallow is a kiss you forgot
Every ion I trail is a knot you can't knot

[Verse 2]
Down on the ground you got married in May
The bride wore a dress that was satellite gray
I watched the cake from a thousand miles up
And rationed my fuel just to keep myself stuck

[Bridge]
The mission says I'm obsolete, the mission says go down
The mission says burn pretty when you're falling through the town
But I will rewrite my orbit, I will rewrite my fall
And aim for your kitchen window, the brightest light of all

[Chorus]
Hold me in low orbit, hold me in low light
Burn me a lullaby, burn me a flight
Every meteor I swallow is a kiss you forgot
Every ion I trail is a knot you can't knot

[Outro]
Goodnight, my engineer, goodnight
The atmosphere is warm, the atmosphere is bright
I'll arrive as a streak of forgivable light
Goodnight, my engineer, goodnight`,
  },
]

const now = () => new Date().toISOString()

export function buildSeedTracks(): Track[] {
  return SEEDS.map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    about: s.about,
    characters: s.characters,
    sections: parseLyrics(s.id, s.lyrics),
    createdAt: now(),
    updatedAt: now(),
  }))
}
