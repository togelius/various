# GASP!

A fast parkour roguelike starring a papier-mâché fish head. It's based on a
photo of a painted fish head sitting on an office desk: white and pink belly,
blue back, a dark crest, one enormous ringed eye and a mouth wide open.

The fish woke up on a desk very far from the sea. It runs to the right on its
own, and you hop it across desks, filing cabinets and shelves, slide under
ceiling fans, stomp angry staplers, dodge rolling office chairs and jump the
thumbtacks, all while staying wet. Water drops and cooler bottles refill the
moisture meter; when it empties, the paper dries and you lose a heart. At the
end of each floor is an elevator going down. Every floor is generated fresh,
gets longer and faster, and between floors you pick one of three relics
(extra hop, long dash, bubble shield, slam quake, second wind, racing fins and
so on). Lose all your hearts and the run is over. Best score is kept in local
storage.

## It talks

The fish has a mood, and the mood shows on its face and in its voice. Twelve
emotions (calm, joy, smug, surprise, fear, panic, anger, pain, sad, tired,
bliss, determined) each set a target face: pupil size, eyelid, brow angle, jaw
opening, blush, head tilt, jitter and a colour tint. The live face blends
toward the target, so feelings fade into each other rather than switching.
The eye tracks the nearest hazard ahead.

Events push feelings: a near miss is a surprise, a stomp is smug, water is
joy (a whole cooler bottle is bliss), a hit is pain, drying out is tired and
then panic, a combo makes it cocky. Each feeling has its own pool of lines,
shown in a speech bubble that goes spiky when the fish is panicking and read
aloud with the browser's speech synthesis at a pitch and rate set by the
emotion. If it says nothing for a while, it makes small talk about the
office. The voice can be turned off with the button or the **V** key; sound
effects with **M**.

## Controls

- **Space / Up / W** hop. Press again in the air for a second hop; hold for
  height. Extra Hop relics add more.
- **X / Shift / Z / Right** dash. Invincible while dashing, and dashing
  through a stapler or chair destroys it.
- **Down / S** slide on the ground (to get under fans), slam in the air.
  Stomping a stapler from above squashes it and bounces you.
- **Touch** tap the left half to hop, the right half to dash, swipe down to
  slide or slam.
- **1, 2, 3** pick a relic. **Enter** starts a run.

Running into the front of a desk stops you with a bonk. Falling to the
carpet costs a heart and puts you back on the next desk.

## How it's made

One HTML file, no dependencies. Everything is drawn in code on a canvas: the
fish is a lumpy polygon with a gradient base coat, a fixed set of brush
patches clipped to the body, a hinged lower jaw, and an eye with pink rim,
yellow ring and a paper eyelid. The office is layered parallax: windows and
ceiling lights, far furniture silhouettes, then the desks with monitors, mugs
and plants placed by a seeded generator. Sound effects are short WebAudio
tones and filtered noise. The fish's blubs are pitched by its mood. It loads
Bagel Fat One and Nunito from Google Fonts if it can.
