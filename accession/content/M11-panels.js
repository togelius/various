// ACCESSION — M.11's wall panels (BUILD.md §5.2; M4 plan D5.4, D5.5, D7.1), the pack's
// `panels` part: design/samples.md §2.2's intro panel and section panels, trimmed so that the
// prose states no rule and says nowhere where anything stands (js/core/panels.js places each
// panel, and a panel's rule is its module's sentence, generated: the intro panel's is the
// signature's, hourly_demonstration, and "Weather Kept for Trials" carries the secondary's,
// weather_cases, at the first section where it is met). Cut from the sample: "you can see the
// next five doors" (a place); the exchange "on the bell" with its warning bell, and the line
// "kept to its old timetable" (the rule; the slice calls it the chime, and the bell is the
// clock's); "before crossing a doorway"; the stations' "short rails at the side of the
// gallery" (no station travels a rail); the doorways "where the line was narrowest"; the side
// corridor "behind the west wall"; "in this section the cases hold weather", the jars "on the
// floor beside the apparatus", and what breaking a jar, fog and rain do (the rule, and its
// place). Owned by W-PANELS.
'use strict';
Packs.part('M11', 'panels', {
  intro: {
    name: 'Long Galleries, Considered as Telegraph Lines',
    text: 'The building was once too long for a voice to cross, so its longest galleries were fitted as signalling lines. Shutters, flags, lamps and a heliograph at every landing passed each signal on to the next. The logbooks survive. They record every signal sent, when it was sent and when it arrived, and not one message. Each station’s timetable is pinned to its own frame, in a clerk’s hand. The Museum has never established what the line was for. The last Line Superintendent, asked in retirement, said that it was for keeping the line open, and that this had been a full-time job.',
  },
  sections: [
    { gallery: 's1', name: 'The Line',
      text: 'The timetables on the stations’ frames are in several clerks’ hands, and one clerk has corrected another’s spelling of the word arrival, twice. The Museum has left both corrections in place. The logbooks record the line’s injuries in the same columns as its signals, and in the same hand.' },
    { gallery: 's2', name: 'Weather Kept for Trials', module: 'weather_cases',
      text: 'The Line kept fog and rain sealed away, to test whether a signal would carry in bad conditions. The logbooks record each trial, its weather and its result, and the linesmen’s opinion of it. The Line regarded the weather as somebody else’s department. The Museum regards it the same way.' },
  ],
});
